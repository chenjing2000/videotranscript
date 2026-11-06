using Drawing = System.Drawing;
using Forms = System.Windows.Forms;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Effects;
using System.Windows.Threading;
using Brush = System.Windows.Media.Brush;
using Brushes = System.Windows.Media.Brushes;
using Color = System.Windows.Media.Color;
using FontFamily = System.Windows.Media.FontFamily;
using Orientation = System.Windows.Controls.Orientation;
using Cursors = System.Windows.Input.Cursors;

namespace TranscriptStudio.AppLifecycle;

/// <summary>
/// Uses the framework NotifyIcon for the notification-area icon and keeps
/// the application's compact tray menu as a native WPF window.
/// </summary>
internal sealed class TrayIconManager : IDisposable
{
    private readonly Window owner;
    private readonly Action activate;
    private readonly Action exit;
    private readonly Drawing.Icon trayIconImage;
    private readonly Forms.NotifyIcon notifyIcon;
    private bool disposed;
    private TrayMenuWindow? menu;

    public TrayIconManager(Window owner, Action activate, Action exit)
    {
        this.owner = owner;
        this.activate = activate;
        this.exit = exit;

        trayIconImage = LoadApplicationIcon();
        notifyIcon = new Forms.NotifyIcon
        {
            Icon = trayIconImage,
            Text = "Transcript Studio"
        };
        notifyIcon.MouseDoubleClick += OnMouseDoubleClick;
        notifyIcon.MouseUp += OnMouseUp;
        try
        {
            notifyIcon.Visible = true;
        }
        catch
        {
            notifyIcon.Dispose();
            trayIconImage.Dispose();
            throw;
        }

        owner.Closed += OnOwnerClosed;
        AppLog.Write("Tray", "Tray icon created through Windows Forms NotifyIcon.");
    }

    private static Drawing.Icon LoadApplicationIcon()
    {
        var executable = Environment.ProcessPath;
        if (!string.IsNullOrWhiteSpace(executable))
        {
            try
            {
                var icon = Drawing.Icon.ExtractAssociatedIcon(executable);
                if (icon is not null)
                    return icon;
            }
            catch (Exception error)
            {
                AppLog.WriteException("Tray.LoadIcon", error);
            }
        }

        return (Drawing.Icon)Drawing.SystemIcons.Application.Clone();
    }

    private void OnMouseDoubleClick(object? sender, Forms.MouseEventArgs e)
    {
        if (e.Button == Forms.MouseButtons.Left)
            QueueOnDispatcher(ActivateExistingWindow);
    }

    private void OnMouseUp(object? sender, Forms.MouseEventArgs e)
    {
        if (e.Button == Forms.MouseButtons.Right)
            QueueOnDispatcher(ShowMenu);
    }

    private void QueueOnDispatcher(Action action)
    {
        if (disposed || owner.Dispatcher.HasShutdownStarted || owner.Dispatcher.HasShutdownFinished)
            return;

        try
        {
            owner.Dispatcher.BeginInvoke(DispatcherPriority.Normal, action);
        }
        catch (InvalidOperationException error)
        {
            AppLog.WriteException("Tray.Dispatch", error);
        }
    }

    private void ActivateExistingWindow()
    {
        if (disposed) return;

        CloseMenuWithoutAction();
        AppLog.Write("Tray", "Activating the existing main window.");
        try { activate(); }
        catch (Exception error) { AppLog.WriteException("Tray.ActivateWindow", error); }
    }

    private void ShowMenu()
    {
        if (disposed) return;

        if (menu is { IsVisible: true })
        {
            menu.Activate();
            return;
        }

        CloseMenuWithoutAction();

        var created = new TrayMenuWindow(
            onOpen: () =>
            {
                AppLog.Write("Tray", "Menu item selected: Open.");
                ActivateExistingWindow();
            },
            onExit: () =>
            {
                AppLog.Write("Tray", "Menu item selected: Exit.");
                try { exit(); }
                catch (Exception error) { AppLog.WriteException("Tray.Exit", error); }
            },
            onClosed: closed =>
            {
                if (ReferenceEquals(menu, closed))
                    menu = null;
            });

        menu = created;
        try
        {
            created.ShowAtCursor(owner);
            AppLog.Write("Tray", "Tray menu shown.");
        }
        catch (Exception error)
        {
            if (ReferenceEquals(menu, created))
                menu = null;
            if (created.IsVisible) created.CloseWithoutAction();
            AppLog.WriteException("Tray.ShowMenu", error);
        }
    }

    private void CloseMenuWithoutAction()
    {
        var current = menu;
        menu = null;
        current?.CloseWithoutAction();
    }

    private void OnOwnerClosed(object? sender, EventArgs e) => Dispose();

    public void Dispose()
    {
        if (disposed) return;
        disposed = true;

        owner.Closed -= OnOwnerClosed;
        CloseMenuWithoutAction();

        notifyIcon.MouseDoubleClick -= OnMouseDoubleClick;
        notifyIcon.MouseUp -= OnMouseUp;
        notifyIcon.Visible = false;
        notifyIcon.Dispose();
        trayIconImage.Dispose();

        AppLog.Write("Tray", "NotifyIcon disposed.");
    }

    private sealed class TrayMenuWindow : Window
    {
        private const string HoverColor = "#FFFBC7";
        private readonly Action onClosed;
        private Action? pendingAction;
        private bool closeRequested;

        public TrayMenuWindow(
            Action onOpen,
            Action onExit,
            Action<TrayMenuWindow> onClosed)
        {
            this.onClosed = () => onClosed(this);

            Width = 70;
            MinWidth = 70;
            MaxWidth = 70;
            SizeToContent = SizeToContent.Height;
            WindowStyle = WindowStyle.None;
            ResizeMode = ResizeMode.NoResize;
            AllowsTransparency = true;
            Background = Brushes.Transparent;
            ShowInTaskbar = false;
            ShowActivated = true;
            Topmost = true;
            Content = new Border
            {
                Width = 70,
                Background = Brushes.White,
                CornerRadius = new CornerRadius(11),
                BorderBrush = new SolidColorBrush(Color.FromRgb(232, 232, 232)),
                BorderThickness = new Thickness(1),
                Effect = new DropShadowEffect
                {
                    BlurRadius = 18,
                    ShadowDepth = 2,
                    Opacity = 0.16
                },
                Padding = new Thickness(3),
                Child = new StackPanel
                {
                    Children =
                    {
                        CreateItem("打开", "▣", () => Select(onOpen)),
                        CreateItem("退出", "⏻", () => Select(onExit))
                    }
                }
            };

            Deactivated += (_, _) =>
            {
                if (pendingAction is null)
                    CloseWithoutAction();
            };
            Closed += (_, _) =>
            {
                var action = pendingAction;
                pendingAction = null;
                AppLog.Write("Tray", "Tray menu closed.");
                this.onClosed();

                // Run the selected action only after the WPF menu has fully closed.
                if (action is not null &&
                    !Dispatcher.HasShutdownStarted &&
                    !Dispatcher.HasShutdownFinished)
                {
                    Dispatcher.BeginInvoke(DispatcherPriority.Background, new Action(() =>
                    {
                        try { action(); }
                        catch (Exception error) { AppLog.WriteException("Tray.MenuAction", error); }
                    }));
                }
            };
        }

        private void Select(Action action)
        {
            if (closeRequested || pendingAction is not null) return;
            pendingAction = action;
            closeRequested = true;
            Close();
        }

        public void CloseWithoutAction()
        {
            pendingAction = null;
            if (closeRequested) return;
            closeRequested = true;
            Close();
        }

        private static Border CreateItem(string label, string glyph, Action action)
        {
            var symbol = new TextBlock
            {
                Text = glyph,
                FontFamily = new FontFamily("Segoe UI Symbol"),
                FontSize = 14,
                Width = 15,
                Foreground = new SolidColorBrush(Color.FromRgb(55, 55, 55)),
                VerticalAlignment = VerticalAlignment.Center
            };
            var text = new TextBlock
            {
                Text = label,
                FontFamily = new FontFamily("Segoe UI"),
                FontSize = 13,
                Foreground = new SolidColorBrush(Color.FromRgb(35, 35, 35)),
                VerticalAlignment = VerticalAlignment.Center
            };
            var row = new StackPanel { Orientation = Orientation.Horizontal };
            row.Children.Add(symbol);
            row.Children.Add(text);

            var item = new Border
            {
                Height = 36,
                HorizontalAlignment = System.Windows.HorizontalAlignment.Stretch,
                Padding = new Thickness(5, 0, 5, 0),
                CornerRadius = new CornerRadius(6),
                Background = Brushes.Transparent,
                Child = row,
                Cursor = Cursors.Hand
            };
            item.MouseEnter += (_, _) =>
                item.Background = (Brush)new BrushConverter().ConvertFromString(HoverColor)!;
            item.MouseLeave += (_, _) => item.Background = Brushes.Transparent;
            item.MouseLeftButtonUp += (_, e) =>
            {
                e.Handled = true;
                action();
            };
            return item;
        }

        public void ShowAtCursor(Window dpiReference)
        {
            var cursor = Forms.Cursor.Position;
            var screen = Forms.Screen.FromPoint(cursor);

            // First place the invisible menu on the cursor's monitor. WPF then
            // reports that monitor's DPI, which is used for exact DIP placement.
            var referenceDpi = VisualTreeHelper.GetDpi(dpiReference);
            Opacity = 0;
            Left = cursor.X / referenceDpi.DpiScaleX;
            Top = cursor.Y / referenceDpi.DpiScaleY;
            Show();

            var dpi = VisualTreeHelper.GetDpi(this);
            var scaleX = dpi.DpiScaleX;
            var scaleY = dpi.DpiScaleY;
            var work = screen.WorkingArea;

            var leftBound = work.Left / scaleX;
            var topBound = work.Top / scaleY;
            var rightBound = work.Right / scaleX;
            var bottomBound = work.Bottom / scaleY;
            var cursorX = cursor.X / scaleX;
            var cursorY = cursor.Y / scaleY;

            var x = cursorX - Width;
            if (x < leftBound) x = cursorX + 8;
            Left = Math.Clamp(x, leftBound, Math.Max(leftBound, rightBound - Width));

            var y = cursorY - Height - 8;
            if (y < topBound) y = cursorY + 8;
            Top = Math.Clamp(y, topBound, Math.Max(topBound, bottomBound - Height));

            Opacity = 1;
            Activate();
        }
    }
}
