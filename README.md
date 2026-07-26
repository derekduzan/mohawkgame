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
