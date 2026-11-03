# Highlight algorithm

For visible word w with valid audio times s/e, define `p(t)=clamp((t-s)/(e-s),0,1)`. Render color from LEFT to RIGHT at p*100%, current word thus partially colored during pronunciation, earlier words fully colored, future words normal color. Use a text-clipped horizontal gradient with a HARD boundary, not color interpolation across the entire word. Punctuation belongs to the word. On seek/reverse/pause calculate p directly from media timestamp, never increment progress by timer. Export: t=frame/fps. Invalid end<=start => warning (currently `wordProgress` returns 0).

Numerical tests: before s=0, at s=0, midpoint=.5, end=1, after e=1, rewind restores intermediate p. HTML may use `background-clip:text; color:transparent`; ensure browser and Remotion output match for glyph coverage and interpolation. Use fixed fonts and load them before measuring lines.
