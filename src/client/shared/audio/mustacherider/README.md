# MustacheRider receipt sounds

The project owner supplied these MP3s in `Mustach/`. They are moved here unchanged and bundled by Vite:

- `cha-ching.mp3` — original `Cha-Ching.mp3`, starts when the receipt alert triggers.
- `print-receipt.mp3` — original `PrintReceipt.mp3`, starts with the printing animation after the cha-ching lead-in (1500ms) and stops at tear-off (3900ms).
- `paper-rip.mp3` — original `PaperRip.mp3`, starts at tear-off (3900ms), before the rotation.

The receipt stays hidden during a 1.5-second cash-chime lead-in. The chime stops when printing starts; the printer sound is cut at tear-off, while the rip plays its natural tail during rotation. The sequence lasts at least 16.5 seconds, including a minimum 10-second visible hold. Long messages extend the hold for slower reading without replaying any sounds. Live alerts, resends, and live tests use these sounds instead of the uploaded file. The shared volume applies; zero mutes the built-in sounds. Dashboard visual previews remain silent; the sound test plays the same audio sequence locally.
