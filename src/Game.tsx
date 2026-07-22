"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type MatchState = "intro" | "fighting" | "player-down" | "enemy-down" | "won" | "lost";
type FighterPose =
  | "idle"
  | "windup-left"
  | "windup-right"
  | "windup-body"
  | "windup-heavy"
  | "windup-uppercut"
  | "attack-left"
  | "attack-right"
  | "attack-body"
  | "attack-heavy"
  | "attack-uppercut"
  | "taunt"
  | "guard"
  | "hit-left"
  | "hit-right"
  | "hit-body"
  | "stunned"
  | "knockout";
type PlayerPose =
  | "idle"
  | "jab-left"
  | "cross-right"
  | "body-hook"
  | "dodge-left"
  | "dodge-right"
  | "block"
  | "hit";
type DodgeDirection = "left" | "right" | null;

const MAX_HEALTH = 100;
const ROUND_TIME = 90;
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const POSE_ASSETS = [
  asset("/opponent-guard.webp"), asset("/opponent-windup-left.webp"), asset("/opponent-punch-left.webp"),
  asset("/opponent-windup-right.webp"), asset("/opponent-punch-right.webp"),
  asset("/opponent-body-windup.webp"), asset("/opponent-body-punch.webp"),
  asset("/opponent-uppercut-windup.webp"), asset("/opponent-uppercut.webp"), asset("/opponent-taunt.webp"),
  asset("/opponent-hit-jab.webp"), asset("/opponent-hit-cross.webp"), asset("/opponent-hit-body.webp"),
  asset("/player-guard.webp"), asset("/player-jab-left.webp"), asset("/player-cross-right.webp"),
  asset("/player-body-hook.webp"), asset("/player-block.webp"), asset("/player-hit.webp"), asset("/opponent-victory.webp"),
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export default function Home() {
  const [matchState, setMatchState] = useState<MatchState>("intro");
  const [enemyHealth, setEnemyHealth] = useState(MAX_HEALTH);
  const [playerHealth, setPlayerHealth] = useState(MAX_HEALTH);
  const [stamina, setStamina] = useState(100);
  const [guard, setGuard] = useState(100);
  const [timer, setTimer] = useState(ROUND_TIME);
  const [enemyPose, setEnemyPose] = useState<FighterPose>("idle");
  const [playerPose, setPlayerPose] = useState<PlayerPose>("idle");
  const [dodgeDirection, setDodgeDirection] = useState<DodgeDirection>(null);
  const [blocking, setBlocking] = useState(false);
  const [combo, setCombo] = useState(0);
  const [score, setScore] = useState(0);
  const [, setCallout] = useState("READ THE SHOULDERS");
  const [impact, setImpact] = useState<"left" | "right" | "body" | "player" | null>(null);
  const [screenShake, setScreenShake] = useState(false);
  const [hitStop, setHitStop] = useState(false);
  const [secondWind, setSecondWind] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [loadedAssetCount, setLoadedAssetCount] = useState(0);
  const [assetsReady, setAssetsReady] = useState(false);
  const [knockdownCount, setKnockdownCount] = useState(1);
  const [getUpTaps, setGetUpTaps] = useState(0);
  const [playerKnockdowns, setPlayerKnockdowns] = useState(0);
  const [requiredGetUpTaps, setRequiredGetUpTaps] = useState(15);
  const [showRematch, setShowRematch] = useState(false);
  const [enemyKnockdowns, setEnemyKnockdowns] = useState(0);
  const [enemyCount, setEnemyCount] = useState(1);
  const [enemyRiseAt, setEnemyRiseAt] = useState<number | null>(null);
  const [performanceMode, setPerformanceMode] = useState(false);

  const matchRef = useRef(matchState);
  const enemyHealthRef = useRef(enemyHealth);
  const playerHealthRef = useRef(playerHealth);
  const staminaRef = useRef(stamina);
  const guardRef = useRef(guard);
  const blockingRef = useRef(blocking);
  const dodgeRef = useRef<DodgeDirection>(dodgeDirection);
  const poseRef = useRef<FighterPose>(enemyPose);
  const punchLockRef = useRef(false);
  const playerActionRef = useRef(0);
  const bufferedPunchRef = useRef<"left" | "right" | "body" | null>(null);
  const blockStartedAtRef = useRef(0);
  const guardBrokenUntilRef = useRef(0);
  const enemyKnockdownsRef = useRef(0);
  const enemyRiseAtRef = useRef<number | null>(null);
  const enemyRecoveryHealthRef = useRef(0);
  const playerKnockdownsRef = useRef(0);
  const getUpTapsRef = useRef(0);
  const requiredGetUpTapsRef = useRef(15);
  const punchRef = useRef<(kind: "left" | "right" | "body") => void>(() => undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const preloadedImagesRef = useRef<HTMLImageElement[]>([]);
  const preloadStartedRef = useRef(false);

  useEffect(() => void (matchRef.current = matchState), [matchState]);
  useEffect(() => void (enemyHealthRef.current = enemyHealth), [enemyHealth]);
  useEffect(() => void (playerHealthRef.current = playerHealth), [playerHealth]);
  useEffect(() => void (staminaRef.current = stamina), [stamina]);
  useEffect(() => void (guardRef.current = guard), [guard]);
  useEffect(() => void (blockingRef.current = blocking), [blocking]);
  useEffect(() => void (dodgeRef.current = dodgeDirection), [dodgeDirection]);
  useEffect(() => void (poseRef.current = enemyPose), [enemyPose]);

  useEffect(() => {
    if (!assetsReady) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("performance") === "1") {
      setPerformanceMode(true);
      return;
    }

    // The mobile layout already has a lightweight rendering profile. Benchmark
    // only full desktop layouts and automatically shed cosmetic GPU effects if
    // Chrome cannot hold a responsive frame cadence.
    if (!window.matchMedia("(min-width: 821px) and (min-height: 621px)").matches) return;

    let animationFrame = 0;
    let startedAt = 0;
    let previousFrame = 0;
    let sampledFrames = 0;
    let slowFrames = 0;

    const sample = (now: number) => {
      if (!startedAt) {
        startedAt = now;
        previousFrame = now;
      } else {
        const frameTime = now - previousFrame;
        previousFrame = now;
        if (frameTime < 200) {
          sampledFrames += 1;
          if (frameTime > 24) slowFrames += 1;
        }
      }

      if (now - startedAt < 2400) {
        animationFrame = requestAnimationFrame(sample);
        return;
      }

      const slowRatio = sampledFrames ? slowFrames / sampledFrames : 1;
      if (sampledFrames < 105 || slowRatio > 0.18) setPerformanceMode(true);
    };

    animationFrame = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(animationFrame);
  }, [assetsReady]);

  useEffect(() => {
    if (preloadStartedRef.current) return;
    preloadStartedRef.current = true;

    let nextAsset = 0;
    let completed = 0;
    const loadNext = async () => {
      while (nextAsset < POSE_ASSETS.length) {
        const src = POSE_ASSETS[nextAsset++];
        const image = new Image();
        image.decoding = "async";
        image.src = src;
        preloadedImagesRef.current.push(image);
        try {
          await image.decode();
        } catch {
          // Do not strand the player on the loading screen if one optional
          // pose fails. The visible image element will still retry normally.
        }
        completed += 1;
        setLoadedAssetCount(completed);
      }
    };

    // A few parallel workers are considerably gentler on mobile than asking
    // the browser to decode every large transparent sprite simultaneously.
    void Promise.all(Array.from({ length: 3 }, loadNext)).then(() => setAssetsReady(true));
  }, []);

  const setEnemyPoseSafe = useCallback((pose: FighterPose) => {
    poseRef.current = pose;
    setEnemyPose(pose);
  }, []);

  const playSound = useCallback((kind: "punch" | "hurt" | "bell" | "dodge" | "ko") => {
    if (typeof window === "undefined") return;
    const AudioCtx = window.AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioContextRef.current ?? new AudioCtx();
    audioContextRef.current = ctx;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.connect(gain).connect(ctx.destination);

    if (kind === "bell") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(430, now + 0.45);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc.start(now);
      osc.stop(now + 0.8);
      return;
    }

    if (kind === "dodge") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(260, now);
      osc.frequency.exponentialRampToValueAtTime(90, now + 0.12);
      gain.gain.setValueAtTime(0.07, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    } else if (kind === "ko") {
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(36, now + 0.8);
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    } else {
      osc.type = "square";
      osc.frequency.setValueAtTime(kind === "hurt" ? 72 : 105, now);
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.11);
      gain.gain.setValueAtTime(kind === "hurt" ? 0.2 : 0.13, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    }
    osc.start(now);
    osc.stop(now + (kind === "ko" ? 0.9 : 0.15));
  }, []);

  const finishMatch = useCallback((result: "won" | "lost") => {
    const resultActionId = ++playerActionRef.current;
    matchRef.current = result;
    setMatchState(result);
    setShowRematch(false);
    setBlocking(false);
    blockingRef.current = false;
    dodgeRef.current = null;
    setDodgeDirection(null);
    if (result === "won") {
      setEnemyPoseSafe("knockout");
      setCallout("KNOCKOUT!");
      playSound("ko");
    } else {
      setPlayerPose("hit");
      setCallout("YOU'RE DOWN");
      playSound("hurt");
    }
    // Neither punches nor get-up taps can trigger a rematch underneath the
    // player's finger. Each result gets a short uninterrupted celebration.
    window.setTimeout(() => {
      if (matchRef.current === result && playerActionRef.current === resultActionId) {
        setShowRematch(true);
      }
    }, result === "won" ? 2400 : 3000);
  }, [playSound, setEnemyPoseSafe]);

  const startMatch = useCallback(() => {
    if (!assetsReady) return;
    ++playerActionRef.current;
    setEnemyHealth(MAX_HEALTH);
    enemyHealthRef.current = MAX_HEALTH;
    setPlayerHealth(MAX_HEALTH);
    playerHealthRef.current = MAX_HEALTH;
    setStamina(100);
    staminaRef.current = 100;
    setGuard(100);
    guardRef.current = 100;
    setTimer(ROUND_TIME);
    setEnemyPoseSafe("idle");
    setPlayerPose("idle");
    setDodgeDirection(null);
    dodgeRef.current = null;
    setBlocking(false);
    blockingRef.current = false;
    setCombo(0);
    setScore(0);
    setImpact(null);
    setHitStop(false);
    setSecondWind(false);
    enemyKnockdownsRef.current = 0;
    enemyRiseAtRef.current = null;
    enemyRecoveryHealthRef.current = 0;
    setEnemyKnockdowns(0);
    setEnemyCount(1);
    setEnemyRiseAt(null);
    playerKnockdownsRef.current = 0;
    getUpTapsRef.current = 0;
    requiredGetUpTapsRef.current = 15;
    setRequiredGetUpTaps(15);
    setPlayerKnockdowns(0);
    setGetUpTaps(0);
    setKnockdownCount(1);
    setShowRematch(false);
    bufferedPunchRef.current = null;
    guardBrokenUntilRef.current = 0;
    setCallout("FIGHT!");
    matchRef.current = "fighting";
    setMatchState("fighting");
    setAudioReady(true);
    playSound("bell");
    window.setTimeout(() => setCallout("READ THE SHOULDERS"), 900);
  }, [assetsReady, playSound, setEnemyPoseSafe]);

  const takePlayerDamage = useCallback((amount: number) => {
    const actionId = ++playerActionRef.current;
    const next = clamp(playerHealthRef.current - amount);
    playerHealthRef.current = next;
    setPlayerHealth(next);
    setCombo(0);
    setImpact("player");
    setScreenShake(true);
    setPlayerPose("hit");
    playSound("hurt");
    window.setTimeout(() => setImpact(null), 170);
    window.setTimeout(() => setScreenShake(false), 240);
    window.setTimeout(() => {
      if (matchRef.current === "fighting" && playerActionRef.current === actionId) setPlayerPose("idle");
    }, 260);
    if (next <= 0) {
      ++playerActionRef.current;
      punchLockRef.current = false;
      bufferedPunchRef.current = null;
      blockingRef.current = false;
      setBlocking(false);
      const knockdowns = playerKnockdownsRef.current + 1;
      playerKnockdownsRef.current = knockdowns;
      // The first recovery is demanding, and every later knockdown requires
      // five additional taps: 15, 20, 25, 30, and so on.
      requiredGetUpTapsRef.current = 10 + knockdowns * 5;
      setRequiredGetUpTaps(requiredGetUpTapsRef.current);
      getUpTapsRef.current = 0;
      setPlayerKnockdowns(knockdowns);
      setGetUpTaps(0);
      setKnockdownCount(1);
      setCallout("YOU'RE DOWN");
      matchRef.current = "player-down";
      setMatchState("player-down");
    }
  }, [playSound]);

  const attemptGetUp = useCallback(() => {
    if (matchRef.current !== "player-down") return;
    const taps = getUpTapsRef.current + 1;
    getUpTapsRef.current = taps;
    setGetUpTaps(taps);
    if (taps < requiredGetUpTapsRef.current) return;

    const recoveryHealth = Math.max(20, 40 - (playerKnockdownsRef.current - 1) * 10);
    playerHealthRef.current = recoveryHealth;
    staminaRef.current = 100;
    guardRef.current = 70;
    setPlayerHealth(recoveryHealth);
    setStamina(100);
    setGuard(70);
    setPlayerPose("idle");
    setImpact(null);
    setScreenShake(false);
    matchRef.current = "fighting";
    setMatchState("fighting");
    setCallout("BACK ON YOUR FEET!");
    playSound("bell");
  }, [playSound]);

  useEffect(() => {
    if (matchState !== "player-down") return;
    let count = 1;
    let countOutTimer: number | undefined;
    const countTimer = window.setInterval(() => {
      count += 1;
      setKnockdownCount(count);
      if (count >= 10) {
        window.clearInterval(countTimer);
        countOutTimer = window.setTimeout(() => {
          if (matchRef.current === "player-down") finishMatch("lost");
        }, 650);
      }
    }, 800);
    return () => {
      window.clearInterval(countTimer);
      if (countOutTimer) window.clearTimeout(countOutTimer);
    };
  }, [finishMatch, matchState]);

  useEffect(() => {
    if (matchState !== "enemy-down") return;
    let count = 1;
    let resolutionTimer: number | undefined;
    const countTimer = window.setInterval(() => {
      count += 1;
      setEnemyCount(count);
      const riseAt = enemyRiseAtRef.current;

      if (riseAt !== null && count >= riseAt) {
        window.clearInterval(countTimer);
        resolutionTimer = window.setTimeout(() => {
          if (matchRef.current !== "enemy-down") return;
          const recoveryHealth = enemyRecoveryHealthRef.current;
          enemyHealthRef.current = recoveryHealth;
          setEnemyHealth(recoveryHealth);
          setEnemyPoseSafe("idle");
          setSecondWind(true);
          matchRef.current = "fighting";
          setMatchState("fighting");
          setCallout(`MOHAWK RISES WITH ${recoveryHealth}%!`);
          playSound("bell");
          window.setTimeout(() => setSecondWind(false), 2600);
        }, 300);
      } else if (riseAt === null && count >= 10) {
        window.clearInterval(countTimer);
        resolutionTimer = window.setTimeout(() => {
          if (matchRef.current === "enemy-down") finishMatch("won");
        }, 650);
      }
    }, 800);
    return () => {
      window.clearInterval(countTimer);
      if (resolutionTimer) window.clearTimeout(resolutionTimer);
    };
  }, [finishMatch, matchState, playSound, setEnemyPoseSafe]);

  useEffect(() => {
    if (matchState !== "fighting") return;
    const ticker = window.setInterval(() => {
      setTimer((value) => {
        if (value <= 1) {
          const result = enemyHealthRef.current < playerHealthRef.current ? "won" : "lost";
          finishMatch(result);
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(ticker);
  }, [finishMatch, matchState]);

  useEffect(() => {
    if (matchState !== "fighting") return;
    const recovery = window.setInterval(() => {
      if (!punchLockRef.current && !blockingRef.current) {
        setStamina((value) => {
          const next = clamp(value + 9.5);
          staminaRef.current = next;
          return next;
        });
      }
      if (!blockingRef.current) {
        setGuard((value) => {
          const next = clamp(value + 3.5);
          guardRef.current = next;
          return next;
        });
      }
    }, 250);
    return () => window.clearInterval(recovery);
  }, [matchState]);

  useEffect(() => {
    if (matchState !== "fighting") return;
    type EnemyMove = "left" | "right" | "body" | "uppercut";
    type AttackStyle = "normal" | "heavy" | "flurry" | "uppercut";
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, delay: number) => {
      const id = window.setTimeout(() => !cancelled && fn(), delay);
      timers.push(id);
    };

    const queueAttack = () => {
      if (cancelled || matchRef.current !== "fighting") return;
      const rage = enemyHealthRef.current <= 35;
      const delay = rage ? 180 + Math.random() * 200 : 320 + Math.random() * 280;
      later(beginAttack, delay);
    };

    const chooseCombination = (): EnemyMove[] => {
      const roll = Math.random();
      if (roll < 0.18) return ["left"];
      if (roll < 0.32) return ["right"];
      if (roll < 0.43) return ["body"];
      if (roll < 0.58) return ["left", "left"];
      if (roll < 0.74) return ["left", "right"];
      if (roll < 0.87) return ["body", "right"];
      return ["left", "right", "left"];
    };

    const doTaunt = () => {
      if (cancelled || matchRef.current !== "fighting") return;
      setEnemyPoseSafe("taunt");
      setCallout("MOHAWK GRINS");
      later(() => {
        if (matchRef.current !== "fighting") return;
        if (poseRef.current === "taunt") {
          const recovered = clamp(enemyHealthRef.current + 1.5);
          enemyHealthRef.current = recovered;
          setEnemyHealth(recovered);
          setEnemyPoseSafe("idle");
        }
        queueAttack();
      }, 780);
    };

    const throwStrike = (combination: EnemyMove[], index: number, style: AttackStyle = "normal") => {
      if (cancelled || matchRef.current !== "fighting") return;
      const move = combination[index];
      const rage = enemyHealthRef.current <= 35;
      const firstPunch = index === 0;
      const windup = style === "heavy" ? 760
        : style === "uppercut" ? 480
        : style === "flurry" ? firstPunch ? 185 : 58
        : firstPunch ? rage ? 240 : move === "body" ? 430 : 340
        : rage ? 90 : move === "body" ? 180 : 130;
      const windupPose: FighterPose = style === "heavy" ? "windup-heavy"
        : style === "uppercut" ? "windup-uppercut"
        : `windup-${move}` as FighterPose;
      const attackPose: FighterPose = style === "heavy" ? "attack-heavy"
        : style === "uppercut" ? "attack-uppercut"
        : `attack-${move}` as FighterPose;
      setEnemyPoseSafe(windupPose);
      setCallout(style === "heavy" ? "HE'S LOADING UP" : style === "flurry" ? "VOLUME FLURRY" : style === "uppercut" ? "WATCH THE CENTER" : "PRESSURE");

      later(() => {
        if (matchRef.current !== "fighting") return;
        setEnemyPoseSafe(attackPose);
        // Let the committed punch frame render before resolving contact.
        // This keeps the visual impact and damage event in the same sequence.
        later(() => {
          if (matchRef.current !== "fighting") return;
          // A strike may only resolve while its matching punch frame is still
          // on screen. If the player interrupted Esteban during this window,
          // cancel the contact instead of applying invisible damage.
          if (poseRef.current !== attackPose) {
            queueAttack();
            return;
          }
          const dodged = dodgeRef.current !== null &&
            (move === "body" || move === "uppercut" || (move === "left" && dodgeRef.current === "right") || (move === "right" && dodgeRef.current === "left"));

          if (dodged) {
            setCallout("PERFECT SLIP — COUNTER!");
            setEnemyPoseSafe("stunned");
            setScore((value) => value + 250);
            playSound("dodge");
            later(() => {
              if (matchRef.current === "fighting" && poseRef.current === "stunned") {
                setEnemyPoseSafe("idle");
                setCallout(enemyHealthRef.current <= 35 ? "MOHAWK IS RAGING" : "STAY SHARP");
              }
              queueAttack();
            }, rage ? 340 : 480);
            return;
          }

          if (blockingRef.current && guardRef.current > 0) {
            const lateBlock = performance.now() - blockStartedAtRef.current < 95;
            const baseGuardCost = style === "heavy" ? 42 : style === "uppercut" ? 34 : style === "flurry" ? 14 : move === "body" ? 30 : 22;
            const guardCost = baseGuardCost + (lateBlock ? 9 : 0);
            const nextGuard = clamp(guardRef.current - guardCost);
            guardRef.current = nextGuard;
            setGuard(nextGuard);
            const chip = style === "heavy" ? 9 : style === "uppercut" ? 7 : style === "flurry" ? 2 : move === "body" ? 5 : 3;
            takePlayerDamage(lateBlock ? chip + 4 : chip);
            setCallout(nextGuard <= 0 ? "GUARD BROKEN!" : lateBlock ? "LATE BLOCK" : "BLOCKED");
            if (nextGuard <= 0) {
              setBlocking(false);
              blockingRef.current = false;
              guardBrokenUntilRef.current = performance.now() + 700;
            }
          } else {
            const damage = style === "heavy" ? 27 : style === "uppercut" ? 22 : style === "flurry" ? 7 : move === "body" ? 18 : rage ? 17 : 14;
            takePlayerDamage(damage);
            setCallout(style === "heavy" ? "HEAVY BOMB!" : style === "uppercut" ? "UPPERCUT!" : move === "body" ? "LIVER SHOT!" : "CLEAN HIT");
          }

          if (index + 1 < combination.length) {
            later(() => throwStrike(combination, index + 1, style), style === "flurry" ? 34 : rage ? 55 : 85);
          } else {
            later(() => {
              if (matchRef.current === "fighting") {
                setEnemyPoseSafe("idle");
                if (Math.random() < .16) doTaunt(); else queueAttack();
              }
            }, rage ? 230 : 360);
          }
        }, style === "heavy" ? 320 : style === "uppercut" ? 280 : style === "flurry" ? 92 : rage ? 125 : 155);
      }, windup);
    };

    const beginAttack = () => {
      if (cancelled || matchRef.current !== "fighting") return;
      // A counter can leave the fighter in the stunned pose after the hit
      // reaction completes. Never keep re-queuing against that pose forever:
      // visibly recover, then resume offense from a clean idle state.
      if (poseRef.current === "stunned") {
        setEnemyPoseSafe("idle");
        later(beginAttack, 180);
        return;
      }
      if (poseRef.current.startsWith("hit")) {
        queueAttack();
        return;
      }
      const pattern = Math.random();
      if (pattern < .16) throwStrike(["right"], 0, "heavy");
      else if (pattern < .32) throwStrike(["left", "right", "left", "right", "left"], 0, "flurry");
      else if (pattern < .46) throwStrike(["uppercut"], 0, "uppercut");
      else if (pattern < .56) doTaunt();
      else throwStrike(chooseCombination(), 0);
    };

    later(queueAttack, 750);
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [matchState, playSound, setEnemyPoseSafe, takePlayerDamage]);

  const punch = useCallback((kind: "left" | "right" | "body"): void => {
    if (matchRef.current !== "fighting" || blockingRef.current) return;
    if (punchLockRef.current) {
      bufferedPunchRef.current = kind;
      return;
    }
    const cost = kind === "left" ? 6 : kind === "right" ? 9 : 11;
    if (staminaRef.current < cost) {
      setCallout("BREATHE — LOW STAMINA");
      return;
    }

    punchLockRef.current = true;
    const actionId = ++playerActionRef.current;
    const nextStamina = clamp(staminaRef.current - cost);
    staminaRef.current = nextStamina;
    setStamina(nextStamina);
    setPlayerPose(kind === "left" ? "jab-left" : kind === "right" ? "cross-right" : "body-hook");

    // Resolve damage on the extension/contact frame, never on button-down.
    window.setTimeout(() => {
      if (matchRef.current !== "fighting" || playerActionRef.current !== actionId || blockingRef.current) return;
      const enemyIsOpen = poseRef.current === "stunned" || poseRef.current.startsWith("windup");
      const enemyIsGuarding = poseRef.current === "guard";
      const base = kind === "left" ? 4 : kind === "right" ? 7 : 6;
      const fullDamage = enemyIsGuarding ? 1 : enemyIsOpen ? Math.round(base * 2.1) : base;
      const damage = fullDamage / 6;
      const nextHealth = clamp(enemyHealthRef.current - damage);

      enemyHealthRef.current = nextHealth;
      setEnemyHealth(nextHealth);
      setCombo((value) => value + 1);
      setScore((value) => value + damage * 100 + (enemyIsOpen ? 350 : 0));
      setImpact(kind);
      setHitStop(true);
      setScreenShake(true);
      setEnemyPoseSafe(kind === "left" ? "hit-right" : kind === "right" ? "hit-left" : "hit-body");
      playSound("punch");
      setCallout(enemyIsOpen ? `COUNTER +${damage}` : kind === "body" ? "BODY SHOT" : "CONNECTS");
      window.setTimeout(() => setHitStop(false), 52);
      window.setTimeout(() => setScreenShake(false), 82);
      window.setTimeout(() => setImpact(null), 120);

      if (nextHealth <= 0) {
        const knockdowns = enemyKnockdownsRef.current + 1;
        enemyKnockdownsRef.current = knockdowns;
        setEnemyKnockdowns(knockdowns);
        const recoveryPlans = [
          { health: 75, min: 2, max: 4 },
          { health: 50, min: 4, max: 6 },
          { health: 24, min: 6, max: 8 },
        ];
        const plan = recoveryPlans[knockdowns - 1];
        const riseAt = plan ? plan.min + Math.floor(Math.random() * (plan.max - plan.min + 1)) : null;
        enemyRiseAtRef.current = riseAt;
        enemyRecoveryHealthRef.current = plan?.health ?? 0;
        setEnemyRiseAt(riseAt);
        setEnemyCount(1);
        ++playerActionRef.current;
        punchLockRef.current = false;
        bufferedPunchRef.current = null;
        setEnemyPoseSafe("knockout");
        setSecondWind(Boolean(plan));
        setCallout(plan ? "MOHAWK IS DOWN — THE COUNT STARTS!" : "STAY DOWN!");
        matchRef.current = "enemy-down";
        setMatchState("enemy-down");
        playSound("ko");
        return;
      }

      window.setTimeout(() => {
        if (matchRef.current !== "fighting") return;
        const rage = enemyHealthRef.current <= 35;
        if (Math.random() < (rage ? 0.32 : 0.18)) {
          setEnemyPoseSafe("guard");
          window.setTimeout(() => {
            if (matchRef.current === "fighting" && poseRef.current === "guard") setEnemyPoseSafe("idle");
          }, rage ? 260 : 400);
        } else if (poseRef.current.startsWith("hit")) {
          if (enemyIsOpen) {
            setEnemyPoseSafe("stunned");
            // Counter-stun is a short reward window, not a permanent AI state.
            window.setTimeout(() => {
              if (matchRef.current === "fighting" && poseRef.current === "stunned") {
                setEnemyPoseSafe("idle");
              }
            }, 360);
          } else {
            setEnemyPoseSafe("idle");
          }
        }
      }, enemyIsOpen ? 220 : kind === "left" ? 145 : kind === "right" ? 210 : 220);
    }, kind === "left" ? 72 : kind === "right" ? 98 : 105);

    // Retract before accepting the buffered strike. Keeping the lock active
    // during this short guard frame guarantees a full extension on every hit,
    // even when the same punch button is being spammed.
    window.setTimeout(() => {
      if (matchRef.current === "fighting" && !blockingRef.current && playerActionRef.current === actionId) {
        setPlayerPose("idle");
      }
    }, kind === "left" ? 145 : 175);

    window.setTimeout(() => {
      punchLockRef.current = false;
      const buffered = bufferedPunchRef.current;
      bufferedPunchRef.current = null;
      if (buffered && matchRef.current === "fighting" && !blockingRef.current) punchRef.current(buffered);
    }, kind === "left" ? 205 : 235);
  }, [playSound, setEnemyPoseSafe]);

  useEffect(() => void (punchRef.current = punch), [punch]);

  const dodge = useCallback((direction: Exclude<DodgeDirection, null>) => {
    if (matchRef.current !== "fighting" || dodgeRef.current || blockingRef.current) return;
    const actionId = ++playerActionRef.current;
    dodgeRef.current = direction;
    setDodgeDirection(direction);
    setPlayerPose(direction === "left" ? "dodge-left" : "dodge-right");
    playSound("dodge");
    window.setTimeout(() => {
      dodgeRef.current = null;
      setDodgeDirection(null);
      if (matchRef.current === "fighting" && !blockingRef.current && playerActionRef.current === actionId) {
        setPlayerPose("idle");
      }
    }, 300);
  }, [playSound]);

  const beginBlock = useCallback(() => {
    if (matchRef.current !== "fighting" || guardRef.current <= 0 || performance.now() < guardBrokenUntilRef.current) return;
    // Guard has absolute input priority: cancel any active offensive/evasive
    // recovery immediately so no older animation can override the block pose.
    punchLockRef.current = false;
    bufferedPunchRef.current = null;
    dodgeRef.current = null;
    ++playerActionRef.current;
    blockingRef.current = true;
    blockStartedAtRef.current = performance.now();
    // Blocking is a defensive input, not an animation windup. Commit the
    // protection state and visible guard during this exact pointer/key event.
    flushSync(() => {
      setBlocking(true);
      setDodgeDirection(null);
      setPlayerPose("block");
    });
  }, []);

  const endBlock = useCallback(() => {
    ++playerActionRef.current;
    blockingRef.current = false;
    setBlocking(false);
    if (matchRef.current === "fighting") setPlayerPose("idle");
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (matchRef.current === "player-down") {
        event.preventDefault();
        attemptGetUp();
      } else if (matchRef.current === "intro" && (key === "enter" || key === " ")) {
        event.preventDefault();
        startMatch();
      } else if (key === "a" || key === "arrowleft") dodge("left");
      else if (key === "d" || key === "arrowright") dodge("right");
      else if (key === "j") punch("left");
      else if (key === "k") punch("right");
      else if (key === "l") punch("body");
      else if (key === " ") {
        event.preventDefault();
        beginBlock();
      }
    };
    const up = (event: KeyboardEvent) => {
      if (event.key === " ") endBlock();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [attemptGetUp, beginBlock, dodge, endBlock, punch, startMatch]);

  const timerText = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`;
  const rage = enemyHealth <= 35 && enemyHealth > 0;
  const damageTier = enemyHealth <= 25 ? 3 : enemyHealth <= 50 ? 2 : enemyHealth <= 75 ? 1 : 0;
  const visionClass = playerHealth <= 20 ? "vision-critical" : playerHealth <= 40 ? "vision-hurt" : "";
  const loadingProgress = Math.round((loadedAssetCount / POSE_ASSETS.length) * 100);
  const opponentAsset = enemyPose === "windup-left"
    ? asset("/opponent-windup-left.webp")
    : enemyPose === "attack-left"
      ? asset("/opponent-punch-left.webp")
      : enemyPose === "windup-right"
        ? asset("/opponent-windup-right.webp")
        : enemyPose === "attack-right"
          ? asset("/opponent-punch-right.webp")
          : enemyPose === "windup-body"
            ? asset("/opponent-body-windup.webp")
            : enemyPose === "attack-body"
              ? asset("/opponent-body-punch.webp")
              : enemyPose === "windup-heavy"
                ? asset("/opponent-windup-right.webp")
                : enemyPose === "attack-heavy"
                  ? asset("/opponent-punch-right.webp")
                  : enemyPose === "windup-uppercut"
                    ? asset("/opponent-uppercut-windup.webp")
                    : enemyPose === "attack-uppercut"
                      ? asset("/opponent-uppercut.webp")
                      : enemyPose === "taunt"
                        ? asset("/opponent-taunt.webp")
                        : enemyPose === "hit-right"
                          ? asset("/opponent-hit-jab.webp")
                          : enemyPose === "hit-left"
                            ? asset("/opponent-hit-cross.webp")
                            : enemyPose === "hit-body"
                              ? asset("/opponent-hit-body.webp")
              : asset("/opponent-guard.webp");
  const playerAsset = playerPose === "jab-left"
    ? asset("/player-jab-left.webp")
    : playerPose === "cross-right"
      ? asset("/player-cross-right.webp")
      : playerPose === "body-hook"
        ? asset("/player-body-hook.webp")
        : playerPose === "hit"
            ? asset("/player-hit.webp")
            : asset("/player-guard.webp");

  return (
    <main className={`game-shell ${performanceMode ? "is-performance" : ""} ${screenShake ? "is-shaking" : ""} ${hitStop ? "is-hit-stop" : ""} ${visionClass}`}>
      <section className={`arena ${matchState === "fighting" ? "is-live" : ""}`} aria-label="Bare knuckle boxing ring">
        <div className="grain" aria-hidden="true" />
        <div className="vision-damage" aria-hidden="true"><i /><b /></div>
        <div className="ceiling-lights" aria-hidden="true"><i /><i /><i /></div>
        <div className={`crowd ${secondWind ? "is-chanting" : ""}`} aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => <i key={index} />)}
          <div className="crowd-chant"><span>MO—HAWK!</span><span>MO—HAWK!</span></div>
        </div>
        <div className="ring-post post-left" aria-hidden="true" />
        <div className="ring-post post-right" aria-hidden="true" />
        <div className="ropes" aria-hidden="true"><i /><i /><i /></div>
        <div className="ring-floor" aria-hidden="true"><span>BARE KNUCKLE</span></div>

        <header className="fight-hud">
          <div className="fighter-card player-card">
            <div className="name-row"><strong>YOU</strong><span>{Math.ceil(playerHealth)}</span></div>
            <div className="health-track"><span style={{ width: `${playerHealth}%` }} /></div>
            <div className="mini-meter"><em>STAMINA</em><i style={{ width: `${stamina}%` }} /></div>
            <div className="mini-meter guard-meter"><em>GUARD</em><i style={{ width: `${guard}%` }} /></div>
          </div>

          <div className="round-clock">
            <span>ROUND</span><strong>1</strong><time>{timerText}</time>
          </div>

          <div className={`fighter-card opponent-card ${rage ? "rage" : ""}`}>
            <div className="name-row"><strong>THE MOHAWK</strong><span>{Math.ceil(enemyHealth)}</span></div>
            <div className="health-track"><span style={{ width: `${enemyHealth}%` }} /></div>
            <p>{rage ? "RAGE MODE" : "PRESSURE FIGHTER"}</p>
          </div>
        </header>

        {combo >= 3 && matchState === "fighting" && <div className="combo-counter"><strong>{combo}</strong><span>HIT COMBO</span></div>}
        {matchState === "fighting" && <div className="score">SCORE {score.toLocaleString()}</div>}

        <div className={`opponent-stage pose-${enemyPose} damage-tier-${damageTier} ${rage ? "is-raging" : ""} ${secondWind && matchState !== "enemy-down" ? "is-second-wind" : ""}`}>
          <div className="opponent-shadow" aria-hidden="true" />
          <img className="opponent-pose-art" src={opponentAsset} alt="A muscular mohawk fighter in the ring" draggable={false} />
          <div className="damage-glow" aria-hidden="true" />
          <div className="facial-damage" aria-hidden="true"><i /><b /><em /></div>
          {rage && <div className="rage-aura" aria-hidden="true" />}
        </div>

        {impact && impact !== "player" && (
          <div className={`impact impact-${impact}`} aria-hidden="true">
            <i /><i /><i /><i /><b>POW!</b>
          </div>
        )}
        {impact === "player" && <div className="hurt-flash" aria-hidden="true" />}

        <div className={`first-person-body player-${playerPose}`} aria-hidden="true">
          <img className="player-pose-art player-main-art" src={playerAsset} alt="" draggable={false} />
          <img className="player-pose-art player-block-art" src={asset("/player-block.webp")} alt="" draggable={false} />
        </div>

        {matchState === "fighting" && (
          <div className="controls" aria-label="Fight controls">
            <div className="move-controls">
              <button onPointerDown={(event) => { event.preventDefault(); dodge("left"); }} aria-label="Dodge left"><kbd>A</kbd><span>SLIP LEFT</span></button>
              <button onPointerDown={(event) => { event.preventDefault(); dodge("right"); }} aria-label="Dodge right"><kbd>D</kbd><span>SLIP RIGHT</span></button>
            </div>
            <div className="punch-controls">
              <button onPointerDown={(event) => { event.preventDefault(); punch("left"); }} aria-label="Left jab"><kbd>J</kbd><span>JAB</span></button>
              <button onPointerDown={(event) => { event.preventDefault(); punch("body"); }} aria-label="Body hook"><kbd>L</kbd><span>BODY</span></button>
              <button onPointerDown={(event) => { event.preventDefault(); punch("right"); }} aria-label="Right cross"><kbd>K</kbd><span>CROSS</span></button>
              <button
                className="block-button"
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginBlock(); }}
                onPointerUp={endBlock}
                onPointerLeave={endBlock}
                onPointerCancel={endBlock}
                aria-label="Hold to block"
              ><kbd>SPACE</kbd><span>HOLD BLOCK</span></button>
            </div>
          </div>
        )}

        {matchState === "player-down" && (
          <div className="overlay knockdown-overlay" role="dialog" aria-label={`Referee count ${knockdownCount}`}>
            <p>REFEREE COUNT · KNOCKDOWN {playerKnockdowns}</p>
            <strong>{knockdownCount}</strong>
            <h2>GET UP!</h2>
            <div className="rise-meter" aria-label={`${getUpTaps} of ${requiredGetUpTaps} recovery taps`}>
              <i style={{ width: `${Math.min(100, (getUpTaps / requiredGetUpTaps) * 100)}%` }} />
            </div>
            <button className="fight-button get-up-button" onPointerDown={(event) => { event.preventDefault(); attemptGetUp(); }}>
              TAP TO RISE <i>↑</i>
            </button>
            <small>{requiredGetUpTaps - getUpTaps > 0 ? `${requiredGetUpTaps - getUpTaps} MORE` : "STAND!"}</small>
          </div>
        )}

        {matchState === "enemy-down" && (
          <div className="enemy-count-overlay" aria-live="assertive">
            <p>MOHAWK KNOCKDOWN {enemyKnockdowns}</p>
            <strong>{enemyCount}</strong>
            <span>{enemyRiseAt === null ? "THE FINAL COUNT" : `CAN HE RISE?`}</span>
          </div>
        )}

        {matchState === "intro" && !assetsReady && (
          <div className="overlay preload-overlay" role="status" aria-live="polite" aria-label={`Loading fight assets, ${loadingProgress}% complete`}>
            <div className="preload-lockup">
              <p>GRIT CITY FIGHT NIGHT</p>
              <h1>BARE <span>KNUCKLE</span></h1>
              <strong>MOHAWK</strong>
            </div>
            <div className="preload-status">
              <div><span>WRAPPING HANDS</span><b>{loadingProgress}%</b></div>
              <div className="preload-track" aria-hidden="true"><i style={{ width: `${loadingProgress}%` }} /></div>
              <p>LOADING FIGHTERS &amp; PUNCHES</p>
            </div>
          </div>
        )}

        {matchState === "intro" && assetsReady && (
          <div className="overlay intro-overlay">
            <div className="title-lockup">
              <p>GRIT CITY FIGHT NIGHT</p>
              <h1><i>BARE</i><br /><span>KNUCKLE</span></h1>
              <div className="slash">MOHAWK</div>
            </div>
            <div className="tale-card">
              <span>MAIN EVENT · 1 ROUND · 90 SECONDS</span>
              <h2>THE MOHAWK</h2>
              <p>He loads up before every bomb. Read the shoulder, slip away from the punch, then punish the opening.</p>
              <div className="how-to">
                <div><kbd>A</kbd><kbd>D</kbd><span>SLIP</span></div>
                <div><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd><span>STRIKE</span></div>
                <div><kbd>SPACE</kbd><span>BLOCK</span></div>
              </div>
              <button className="fight-button" onClick={startMatch}>ENTER THE RING <i>›</i></button>
            </div>
          </div>
        )}

        {(matchState === "won" || matchState === "lost") && (
          <div className={`overlay result-overlay ${matchState}`}>
            {matchState === "lost" ? (
              <>
                <div className="defeat-scene" aria-hidden="true">
                  <img className="victory-mohawk" src={asset("/opponent-victory.webp")} alt="" draggable={false} />
                  <img className="defeated-player" src={asset("/player-hit.webp")} alt="" draggable={false} />
                </div>
                <div className="defeat-copy">
                  <p>OFFICIAL RESULT · KNOCKOUT</p>
                  <h2>THE MOHAWK WINS</h2>
                  <div className="result-stats">
                    <span><em>SCORE</em><strong>{score.toLocaleString()}</strong></span>
                    <span><em>KNOCKDOWNS</em><strong>{playerKnockdowns}</strong></span>
                    <span><em>TIME</em><strong>{timerText}</strong></span>
                  </div>
                  {showRematch ? (
                    <button className="fight-button rematch-button" onClick={startMatch}>FIGHT AGAIN <i>↻</i></button>
                  ) : (
                    <div className="victory-delay" role="status">MOHAWK CELEBRATES...</div>
                  )}
                </div>
              </>
            ) : (
              <div className="champion-screen">
                <div className="gold-confetti" aria-hidden="true">
                  {Array.from({ length: 18 }).map((_, index) => <i key={index} />)}
                </div>
                <img className="fallen-mohawk" src={asset("/opponent-guard.webp")} alt="" draggable={false} />
                <img className="champion-arms" src={asset("/player-block.webp")} alt="" draggable={false} />
                <div className="champion-copy">
                  <p>FOUR KNOCKDOWNS · TEN COUNT</p>
                  <h2>YOU DEFEATED<br /><span>THE MOHAWK</span></h2>
                  <h3>GRIT CITY CHAMPION</h3>
                  <div className="result-stats">
                    <span><em>SCORE</em><strong>{score.toLocaleString()}</strong></span>
                    <span><em>KNOCKDOWNS</em><strong>{enemyKnockdowns}</strong></span>
                    <span><em>TIME</em><strong>{timerText}</strong></span>
                  </div>
                  {showRematch ? (
                    <button className="fight-button rematch-button" onClick={startMatch}>DEFEND THE TITLE <i>↻</i></button>
                  ) : (
                    <div className="victory-delay" role="status">THE CROWD ERUPTS...</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="corner-label">FIRST-PERSON ARCADE BOXING · {audioReady ? "SOUND ON" : "SOUND READY"}</div>
      </section>
    </main>
  );
}
