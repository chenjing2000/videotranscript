using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Markup;
using Button = System.Windows.Controls.Button;
using Orientation = System.Windows.Controls.Orientation;
using HorizontalAlignment = System.Windows.HorizontalAlignment;
using VerticalAlignment = System.Windows.VerticalAlignment;
using Brush = System.Windows.Media.Brush;
using Brushes = System.Windows.Media.Brushes;
using Color = System.Windows.Media.Color;
using FontFamily = System.Windows.Media.FontFamily;

namespace TranscriptStudio.UI;

internal enum FluentDialogIcon
{
    Info,
    Warning,
    Error
}

internal static class FluentDialog
{
    private static readonly FontFamily DialogFont = new("Microsoft YaHei UI");
    private static readonly Brush TextBrush = new SolidColorBrush(Color.FromRgb(36, 36, 36));
    private static readonly Brush BorderBrush = new SolidColorBrush(Color.FromRgb(225, 229, 233));
    private static readonly Brush PrimaryBrush = new SolidColorBrush(Color.FromRgb(15, 108, 189));
    private static readonly Brush DangerBrush = new SolidColorBrush(Color.FromRgb(196, 43, 28));

    private static readonly ControlTemplate RoundedButtonTemplate =
        (ControlTemplate)XamlReader.Parse("""
        <ControlTemplate xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"
                         xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml"
                         TargetType="{x:Type Button}">
            <Border Background="{TemplateBinding Background}"
                    BorderBrush="{TemplateBinding BorderBrush}"
                    BorderThickness="{TemplateBinding BorderThickness}"
                    CornerRadius="6"
                    SnapsToDevicePixels="True">
                <ContentPresenter HorizontalAlignment="Center"
                                  VerticalAlignment="Center"
                                  Margin="{TemplateBinding Padding}"
                                  RecognizesAccessKey="True"/>
            </Border>
        </ControlTemplate>
        """);

    internal static bool ShowConfirmation(
        Window? owner,
        string title,
        string message,
        string safeAction,
        string otherAction,
        bool otherActionIsDangerous = true,
        FluentDialogIcon icon = FluentDialogIcon.Warning)
    {
        var dialog = CreateWindow(owner, title);
        var content = CreateContent(message, icon);

        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 22, 0, 0)
        };

        var safeButton = CreateButton(safeAction, ButtonKind.Primary);
        safeButton.IsDefault = true;
        safeButton.IsCancel = true;
        safeButton.Click += (_, _) => dialog.DialogResult = false;

        var otherButton = CreateButton(
            otherAction,
            otherActionIsDangerous ? ButtonKind.Danger : ButtonKind.Secondary);
        otherButton.IsDefault = false;
        otherButton.IsCancel = false;
        otherButton.Margin = new Thickness(8, 0, 0, 0);
        otherButton.Click += (_, _) => dialog.DialogResult = true;

        actions.Children.Add(safeButton);
        actions.Children.Add(otherButton);
        content.Children.Add(actions);
        dialog.Content = content;

        return dialog.ShowDialog() == true;
    }

    internal static void ShowMessage(
        Window? owner,
        string title,
        string message,
        string closeAction = "确定",
        FluentDialogIcon icon = FluentDialogIcon.Info)
    {
        var dialog = CreateWindow(owner, title);
        var content = CreateContent(message, icon);
        var actions = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            HorizontalAlignment = HorizontalAlignment.Right,
            Margin = new Thickness(0, 22, 0, 0)
        };

        var closeButton = CreateButton(closeAction, ButtonKind.Primary);
        closeButton.IsDefault = true;
        closeButton.IsCancel = true;
        closeButton.Click += (_, _) => dialog.DialogResult = true;

        actions.Children.Add(closeButton);
        content.Children.Add(actions);
        dialog.Content = content;
        dialog.ShowDialog();
    }

    private static Window CreateWindow(Window? owner, string title)
    {
        var dialog = new Window
        {
            Title = title,
            Width = 500,
            SizeToContent = SizeToContent.Height,
            MinHeight = 150,
            ResizeMode = ResizeMode.NoResize,
            WindowStyle = WindowStyle.SingleBorderWindow,
            WindowStartupLocation = owner is null
                ? WindowStartupLocation.CenterScreen
                : WindowStartupLocation.CenterOwner,
            ShowInTaskbar = false,
            Background = Brushes.White,
            FontFamily = DialogFont,
            Foreground = TextBrush
        };

        if (owner is not null) dialog.Owner = owner;
        return dialog;
    }

    private static StackPanel CreateContent(string message, FluentDialogIcon icon)
    {
        var content = new StackPanel { Margin = new Thickness(22, 20, 22, 20) };
        var row = new StackPanel
        {
            Orientation = Orientation.Horizontal,
            VerticalAlignment = VerticalAlignment.Top
        };

        var iconSurface = new Border
        {
            Width = 38,
            Height = 38,
            CornerRadius = new CornerRadius(10),
            Background = icon switch
            {
                FluentDialogIcon.Warning => new SolidColorBrush(Color.FromRgb(255, 244, 206)),
                FluentDialogIcon.Error => new SolidColorBrush(Color.FromRgb(253, 236, 236)),
                _ => new SolidColorBrush(Color.FromRgb(232, 241, 251))
            },
            Margin = new Thickness(0, 1, 14, 0),
            Child = new TextBlock
            {
                Text = icon switch
                {
                    FluentDialogIcon.Warning => "!",
                    FluentDialogIcon.Error => "×",
                    _ => "i"
                },
                FontFamily = DialogFont,
                FontSize = 22,
                FontWeight = FontWeights.SemiBold,
                Foreground = icon switch
                {
                    FluentDialogIcon.Warning => new SolidColorBrush(Color.FromRgb(138, 90, 0)),
                    FluentDialogIcon.Error => DangerBrush,
                    _ => PrimaryBrush
                },
                HorizontalAlignment = HorizontalAlignment.Center,
                VerticalAlignment = VerticalAlignment.Center,
                TextAlignment = TextAlignment.Center
            }
        };

        var messageText = new TextBlock
        {
            Text = message,
            FontFamily = DialogFont,
            FontSize = 14,
            LineHeight = 22,
            Foreground = TextBrush,
            TextWrapping = TextWrapping.Wrap,
            VerticalAlignment = VerticalAlignment.Center,
            MaxWidth = 390
        };

        row.Children.Add(iconSurface);
        row.Children.Add(messageText);
        content.Children.Add(row);
        return content;
    }

    private enum ButtonKind
    {
        Primary,
        Secondary,
        Danger
    }

    private static Button CreateButton(string text, ButtonKind kind)
    {
        (Brush Background, Brush Foreground, Brush Border, Brush Hover) style = kind switch
        {
            ButtonKind.Primary => (
                PrimaryBrush,
                Brushes.White,
                PrimaryBrush,
                new SolidColorBrush(Color.FromRgb(17, 94, 163))),
            ButtonKind.Danger => (
                Brushes.White,
                DangerBrush,
                new SolidColorBrush(Color.FromRgb(226, 183, 180)),
                new SolidColorBrush(Color.FromRgb(253, 242, 241))),
            _ => (
                Brushes.White,
                TextBrush,
                BorderBrush,
                new SolidColorBrush(Color.FromRgb(245, 246, 247)))
        };

        var button = new Button
        {
            Content = text,
            MinWidth = 96,
            Height = 36,
            Padding = new Thickness(14, 0, 14, 0),
            FontFamily = DialogFont,
            FontSize = 14,
            FontWeight = FontWeights.Medium,
            Background = style.Background,
            Foreground = style.Foreground,
            BorderBrush = style.Border,
            BorderThickness = new Thickness(1),
            Template = RoundedButtonTemplate
        };

        button.MouseEnter += (_, _) => button.Background = style.Hover;
        button.MouseLeave += (_, _) => button.Background = style.Background;
        return button;
    }
}
