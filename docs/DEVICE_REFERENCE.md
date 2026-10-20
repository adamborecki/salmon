# Salmon device / equipment reference

Source: project owner's notes. IDs at the bottom are suggested naming conventions.

## FOH
- **Behringer X32** (full-size, not Compact): main FOH console. Wireless mics normally on ch 1-16. Bus 1 = Monitor 1. MVP controls: power, layers, select, mute, faders, gain, HPF, EQ, gate, comp, buses, Sends on Fader, main LR, routing. Rear panel: analog I/O, AES50 ports, expansion slot / Dante connectivity.
- **SSL 2+**: audio interface on the FOH Mac mini, for stereo playback/testing. Path: Mac mini -> SSL 2+ -> analog out -> X32 aux in.
- **Mac mini**: FOH computer, normally left on. Playback, future multitrack recording, Dante Virtual Soundcard / Logic later.

## Wireless
- **Phenyx Pro PTU-6000** receivers: multiple 8-channel units, up to 24 channels. Per-channel analog out/gain. XLR outs feed X32 local analog inputs. States: power, channel active, output/gain, frequency, signal present.
- **Handheld transmitters** (Vocal Jazz): single button = power / tap-to-mute. Ch 1-8 black windscreens, ch 9-16 gray, rainbow color order across sets. Rechargeable AA; fresh alkaline for high-stakes gigs. Never put alkalines on the rechargeable charger.
- **Chargers**: CITYORK AA/AAA NiMH/NiCd, multiple; exact model not critical.
- **Wireless rack power** (owner, 2026-10-19): one master switch, the **Furman on top** of the rack. New practice from fall 2026: switch it on at the start of the gig and off at the end (earlier crews left it on).

## X32 state for Vocal Jazz (owner, 2026-10-19; the MUS 248 "Vocal Jazz Reset")
- **Routing** (owner's photo of ROUTING → INPUT, 2026-10-20): 1-8 **Local 1-8**, 9-16 **Local 9-16**, 17-24 **Local 17-24**, 25-32 **AES50 A25-32**; Aux In = Aux Ins. Connected devices: A = S32, B = none, C = Dante; 48 kHz.
- **AES50 A outputs** (photo, 2026-10-20): 1-8 Output 1-8, 9-16 Output 9-16 (so S32 OUT 1 = X32 Output 1), 17-24 Output 1-8, 25-32 Output 9-16, 33-40 P16 1-8, 41-48 P16 9-16. Whether Output 1 = Bus 1 isn't in the photos.
- **Card:** the only card is an **X-DANTE (32 in / 32 out)**. ROUTING → CARD (photo): Local 1-8, 9-16, 17-24, 25-32 (card out n = Local In n).
- **Scene 01: SALMON-DEFAULT** is loaded and exists, but the owner doesn't trust saved scenes (2026-10-20): check settings by hand.
- **Channel names follow the mics:** CH 11 is "G yellow" (gray windscreen, yellow ring).
- **Every wireless channel at 30 dB gain** (owner, confirmed 2026-10-20). **Low cut on**: 80 Hz recommended (the group may have low basses; the owner was thinking 100 Hz; not decided). **No dynamics** (gate and comp off).
- **Dante multitrack** (owner, 2026-10-19; photos 2026-10-20): Dante Controller transmitter **X32** → receiver **MUS-BH100-MINI** (the FOH Mac mini), one to one (Ctrl-click the device intersection). Logic: Input Device **Dante Virtual Soundcard**, Output Device **External Headphones**, buffer 1024; test session "mic check", 13 tracks on In 1-In 13.
- **BH 102 closet** (photos, 2026-10-20): a double door; the fixed half has a flush bolt on its top edge. Push that half flush with the frame (no gap at the top), then flip the bolt.

## Stage-side / Mains Rack
- **Mackie Mix5**: small mixer at top of rack; analog inputs, accepts phone/playback sources.
- **Middle Atlantic PD-915R**: rack power distribution.
- **Numark MP103 USB**: legacy/deactivated CD/media player, not important.
- **Behringer S32**: digital stagebox, intended AES50 endpoint. Rear (Cary's photo, 2026-10-08): 32 XLR inputs, 16 XLR outputs, AES50 A/B; OUTPUT 1 (tape-labelled) feeds the NX3000's CH A input with the purple cable, i.e. that day Bus 1 reached the monitor amp over AES50 via the S32 (routing can change: PRODUCT_DESIGN section 36).
- **Crown Com-Tech 210**: bottom of rack, drives installed passive ceiling mains.
- **Installed mains**: passive ceiling speakers, high and wide L/R; model not important.

## Monitor Amp Rack
- **Furman M-8Lx**: power conditioning.
- **Behringer NX3000**: primary amp for Vocal Jazz wedges. Rear (Cary's photo, 2026-10-08): speakON outputs CH B / CH A, XLR inputs CH B / CH A, MODE (bridge / stereo / mono) and CROSSOVER switches. The purple XLR into the CH A input comes from the S32's OUTPUT 1; CH B's input is empty. Cary uses Channel A for the wedges.
- **Behringer KM750 x2**, **Crown Com-Tech 800**: additional amps.
- Different amps are used for different setups; model instances separately.

## Monitor wedges
- **Behringer Eurolive VP1220F x3**: passive, 8 ohm, NL4/SpeakON and 1/4".
- **Behringer Eurolive VS1220F x2**: passive, 8 ohm, 1/4" only.
- Typical Vocal Jazz: 3 wedges, one long NL4 run from amp, daisy-chained. Teaching point: connector options differ.

## Other
- **Allen & Heath DT168**: Dante stagebox, present but not the main active device.
- **Possible Behringer SD8**: future AES50 extension / extra I/O, not necessarily installed.

## Signal flow
- Wireless: handheld -> PTU-6000 -> XLR -> X32 local analog in.
- Monitors: X32 Bus 1 -> transport -> monitor amp -> passive wedges.
- Mains: X32 -> transport / stage-side path -> Mains Rack -> Crown amp -> ceiling mains L/R.
- Playback: Mac mini -> SSL 2+ -> X32 aux in -> mains and/or monitors.
- Transport variants (configurable): analog backup, AES50, Dante. Real routing may change; keep device definitions separate from current routing config.

## Suggested IDs
`foh-x32`, `foh-mac-mini`, `foh-ssl2plus`, `wireless-rack`, `ptu6000-receiver-01`, `mains-rack`, `stagebox-s32`, `mains-amp-crown-comtech210`, `monitor-amp-rack`, `monitor-amp-nx3000`, `monitor-wedge-vp1220f-01`, `monitor-wedge-vs1220f-01`, `stagebox-dt168`
