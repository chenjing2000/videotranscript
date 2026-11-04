# Examples: Boundary selection

Example 1 — one speaker's connected idea (one paragraph):

> I prefer dogs. They are friendly and loyal, and I enjoy walking them.

Example 2 — dialogue (two paragraphs):

> Are you a dog person or a cat person, Neil?

> Oh, I'm definitely a dog person. I want a friendly pet.

Example 3 — WhisperX segmentation can cross meaning:

`segment 4` may contain both `... that's the first reason.` and `Another explanation is ...` — put the boundary after the timestamped word `reason.` inside segment 4. Do not split the `segment` or reassign its word timestamps.

Example 4 — one natural paragraph spans several WhisperX segments: keep the same paragraph until its semantic conclusion. Do not mark boundaries at each segment.

Example 5 — one natural paragraph continues across two **reading pages**: the Skill does not mark a new paragraph at the page boundary. EVR handles automatic pagination and continuation without repeating a first-line indent.
