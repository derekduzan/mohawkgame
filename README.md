# FightTime

A first-person arcade bare-knuckle boxing game built for desktop and mobile browsers.

## Publish at derekduzan.github.io/mohawkgame

1. Create a GitHub repository named `mohawkgame` under the `derekduzan` account.
2. Upload everything in this folder to the root of the repository, including the hidden `.github` folder.
3. Commit the files to the `main` branch.
4. Open **Settings → Pages** in the repository.
5. Under **Build and deployment → Source**, choose **GitHub Actions**.
6. Open the **Actions** tab and wait for the FightTime GitHub Pages deployment to finish.
7. Visit <https://derekduzan.github.io/mohawkgame/>.

Every later commit to `main` automatically republishes the game.

## Secret codes

Open **ENTER CODE** on the start menu and enter:

- `SAVAGE` — Savage green Mohawk skin
- `ZUPERMAN` — enables every player-benefit code
- `FLAMEON` — flaming hands
- `IRONJAW` — stronger defense
- `TIMELESS` — unlimited fight clock
- `AURA` — aura and restored guard
- `SLOWMO` — extended slow-motion counter windows
- `ARCADE` — arcade visual effects
- `RUMBLE` — stronger impacts and supported-device vibration
- `FATALITY` — fatality endings
- `BROTALITY` — brotality endings
- `GRAND` — unlocks Tulip Street
- `AZUL` — unlocks the Blue Bridge
- `BIGTIME` — unlocks Madison Square Garden

Active codes can be turned off with their **×** buttons on the start menu.

The `FATALITY` ending uses the approved seven-frame golden-dragon sequence.

## Venue achievements

- Win a code-free fight after being knocked down no more than three times to unlock Tulip Street and learn `GRAND`.
- Win one code-free fight to unlock the Blue Bridge and learn `AZUL`.
- Win a code-free fight by delivering the final knockdown with the special uppercut to unlock Madison Square Garden and learn `BIGTIME`.

Locked venue names remain hidden until they are unlocked. Venue progress is
saved locally in the browser.

## Run locally

Install Node.js 22, then run:

```bash
npm install
npm run dev
```

Open the local address printed in the terminal.

## Player-arm asset rules

- The player must always have one anatomically correct left arm and one anatomically correct right arm.
- Never reuse a right-hand sprite as the left hand without verifying and correcting the thumb, palm, wrist, elbow, lighting, and punch direction.
- Mirroring an image does not by itself guarantee correct anatomy.
- In first-person poses, verify both thumbs are on the correct sides and both fists point away from the player toward the opponent.
- Before accepting any guard, punch, hit-reaction, knockdown, finisher, or victory pose, inspect the two hands together and confirm they belong to the same body and camera perspective.
