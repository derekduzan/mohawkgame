"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type MatchState = "intro" | "fighting" | "paused" | "player-down" | "enemy-down" | "won" | "lost";
type FighterPose =
  | "idle"
  | "windup-left"
  | "windup-right"
  | "windup-body"
  | "windup-heavy"
  | "windup-combo-left"
  | "windup-combo-right"
  | "windup-uppercut"
  | "attack-left"
  | "attack-right"
  | "attack-body"
  | "attack-heavy"
  | "attack-combo-left"
  | "attack-combo-right"
  | "attack-uppercut"
  | "taunt"
  | "guard"
  | "hit-left"
  | "hit-right"
  | "hit-body"
  | "stunned"
  | "stumble-back"
  | "rising"
  | "failed-rise"
  | "returning"
  | "knockdown-knee"
  | "knockout";
type PlayerPose =
  | "idle"
  | "jab-left"
  | "power-jab-charge"
  | "power-jab"
  | "cross-right"
  | "haymaker-charge"
  | "haymaker"
  | "body-hook"
  | "special-uppercut"
  | "dodge-left"
  | "dodge-right"
  | "block"
  | "hit";
type DodgeDirection = "left" | "right" | null;
type ResultReason = "knockout" | "time";
type PunchKind = "left" | "power-jab" | "right" | "body" | "haymaker" | "uppercut";
type KneeDepth = "near" | "far";

const MAX_HEALTH = 100;
const ROUND_TIME = 90;
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const POSE_ASSETS = [
  asset("/opponent-guard.webp"), asset("/opponent-windup-left.webp"), asset("/opponent-punch-left.webp"),
  asset("/opponent-windup-right.webp"), asset("/opponent-punch-right.webp"),
  asset("/opponent-overhand-impact.webp"), asset("/opponent-overhand-right.webp"),
  asset("/opponent-body-windup.webp"), asset("/opponent-body-punch.webp"),
  asset("/opponent-uppercut-windup.webp"), asset("/opponent-uppercut.webp"), asset("/opponent-taunt.webp"),
  asset("/opponent-hit-jab.webp"), asset("/opponent-hit-cross.webp"), asset("/opponent-hit-body.webp"),
  asset("/opponent-knee-breathing.webp"),
  asset("/player-guard.webp"), asset("/player-jab-left.webp"), asset("/player-cross-right.webp"),
  asset("/player-guard-left.webp"), asset("/player-guard-right.webp"), asset("/player-jab-left-arm.webp"),
  asset("/player-cross-right-arm.webp"), asset("/player-body-left-arm.webp"),
  asset("/player-power-jab.webp"), asset("/player-special-uppercut.webp"), asset("/player-special-uppercut-contact.webp"),
  asset("/player-body-hook.webp"), asset("/player-block.webp"), asset("/player-hit.webp"), asset("/opponent-victory.webp"),
  asset("/opponent-victory-left.webp"), asset("/opponent-victory-right.webp"),
  asset("/championship-belt.webp"), asset("/opponent-sportsmanship.webp"), asset("/player-holds-belt.webp"),
  asset("/fighttime-logo.png"),
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

export default function Home() {
  const [matchState, setMatchState] = useState<MatchState>("intro");
  const [paused, setPaused] = useState(false);
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
  const [resultReason, setResultReason] = useState<ResultReason>("knockout");
  const [haymakerCharging, setHaymakerCharging] = useState(false);
  const [jabCharging, setJabCharging] = useState(false);
  const [special, setSpecial] = useState(0);
  const [overhandImpact, setOverhandImpact] = useState(false);
  const [kneeDepth, setKneeDepth] = useState<KneeDepth>("near");

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
  const kneeDepthRef = useRef<KneeDepth>("near");
  const playerKnockdownsRef = useRef(0);
  const getUpTapsRef = useRef(0);
  const requiredGetUpTapsRef = useRef(15);
  const counterReadyUntilRef = useRef(0);
  const punchRef = useRef<(kind: PunchKind) => void>(() => undefined);
  const crossChargeStartedRef = useRef(0);
  const crossChargeTimerRef = useRef(0);
  const crossChargingRef = useRef(false);
  const jabChargeStartedRef = useRef(0);
  const jabChargeTimerRef = useRef(0);
  const jabChargingRef = useRef(false);
  const specialRef = useRef(0);
  const enemyStunHitsRef = useRef(0);
  const enemyWindedUntilRef = useRef(0);
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
  useEffect(() => void (specialRef.current = special), [special]);

  useEffect(() => {
    if (!assetsReady) return;

    const params = new URLSearchParams(window.location.search);
    if (params.get("performance") === "0") {
      window.localStorage.removeItem("mohawk-performance-mode");
    }
    if (params.get("performance") === "1") {
      setPerformanceMode(true);
      window.localStorage.setItem("mohawk-performance-mode", "1");
      return;
    }
    if (window.localStorage.getItem("mohawk-performance-mode") === "1") {
      setPerformanceMode(true);
      return;
    }

    // The mobile layout already has a lightweight rendering profile. Monitor
    // full desktop layouts continuously because corporate laptops can begin
    // smoothly, then throttle after several seconds of full-screen effects.
    if (!window.matchMedia("(min-width: 821px) and (min-height: 621px)").matches) return;

    let animationFrame = 0;
    let windowStartedAt = 0;
    let previousFrame = 0;
    let sampledFrames = 0;
    let slowFrames = 0;
    let consecutiveSlowWindows = 0;
    let activated = false;

    const sample = (now: number) => {
      if (document.hidden) {
        windowStartedAt = now;
        previousFrame = now;
        sampledFrames = 0;
        slowFrames = 0;
        animationFrame = requestAnimationFrame(sample);
        return;
      }

      if (!windowStartedAt) {
        windowStartedAt = now;
        previousFrame = now;
      } else {
        const frameTime = now - previousFrame;
        previousFrame = now;
        if (frameTime < 200) {
          sampledFrames += 1;
          if (frameTime > 24) slowFrames += 1;
        }
      }

      if (now - windowStartedAt >= 2500) {
        const slowRatio = sampledFrames ? slowFrames / sampledFrames : 1;
        const windowIsSlow = sampledFrames < 110 || slowRatio > 0.2;
        consecutiveSlowWindows = windowIsSlow ? consecutiveSlowWindows + 1 : 0;

        if (consecutiveSlowWindows >= 2) {
          activated = true;
          setPerformanceMode(true);
          window.localStorage.setItem("mohawk-performance-mode", "1");
        }

        windowStartedAt = now;
        previousFrame = now;
        sampledFrames = 0;
        slowFrames = 0;
      }

      if (!activated) animationFrame = requestAnimationFrame(sample);
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

  const finishMatch = useCallback((result: "won" | "lost", reason: ResultReason = "knockout") => {
    const resultActionId = ++playerActionRef.current;
    setResultReason(reason);
    matchRef.current = result;
    setMatchState(result);
    setShowRematch(false);
    setBlocking(false);
    blockingRef.current = false;
    dodgeRef.current = null;
    setDodgeDirection(null);
    if (result === "won") {
      setEnemyPoseSafe("knockdown-knee");
      setCallout("MOHAWK CANNOT RISE!");
      playSound("ko");
    } else if (reason === "time") {
      setPlayerPose("idle");
      setCallout("TIME'S UP!");
      playSound("bell");
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
    setResultReason("knockout");
    counterReadyUntilRef.current = 0;
    window.clearTimeout(crossChargeTimerRef.current);
    crossChargingRef.current = false;
    setHaymakerCharging(false);
    window.clearTimeout(jabChargeTimerRef.current);
    jabChargingRef.current = false;
    setJabCharging(false);
    specialRef.current = 0;
    setSpecial(0);
    setOverhandImpact(false);
    setPaused(false);
    enemyStunHitsRef.current = 0;
    enemyWindedUntilRef.current = 0;
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
    kneeDepthRef.current = "near";
    setKneeDepth("near");
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

  const returnToMenu = useCallback(() => {
    ++playerActionRef.current;
    window.clearTimeout(crossChargeTimerRef.current);
    window.clearTimeout(jabChargeTimerRef.current);
    crossChargingRef.current = false;
    jabChargingRef.current = false;
    matchRef.current = "intro";
    setMatchState("intro");
    setShowRematch(false);
    setPaused(false);
    setBlocking(false);
    blockingRef.current = false;
    dodgeRef.current = null;
    setDodgeDirection(null);
    setPlayerPose("idle");
    setEnemyPoseSafe("idle");
    setSecondWind(false);
    setOverhandImpact(false);
    setImpact(null);
    setHitStop(false);
    setScreenShake(false);
    setCallout("");
  }, [setEnemyPoseSafe]);

  const togglePause = useCallback(() => {
    if (matchRef.current === "fighting") {
      matchRef.current = "paused";
      setMatchState("paused");
      setPaused(true);
      setCallout("PAUSED");
    } else if (matchRef.current === "paused") {
      matchRef.current = "fighting";
      setMatchState("fighting");
      setPaused(false);
      setCallout("FIGHT!");
    }
  }, []);

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
      // The knockout strike has finished. Do not leave Mohawk frozen on its
      // fully extended contact frame while the referee counts.
      setEnemyPoseSafe("idle");
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
  }, [playSound, setEnemyPoseSafe]);

  const attemptGetUp = useCallback(() => {
    if (matchRef.current !== "player-down") return;
    const taps = getUpTapsRef.current + 1;
    getUpTapsRef.current = taps;
    setGetUpTaps(taps);
    if (taps < requiredGetUpTapsRef.current) return;

    const recoveryHealth = 50;
    playerHealthRef.current = recoveryHealth;
    staminaRef.current = 100;
    guardRef.current = 70;
    setPlayerHealth(recoveryHealth);
    setStamina(100);
    setGuard(70);
    setPlayerPose("idle");
    setEnemyPoseSafe("idle");
    setImpact(null);
    setScreenShake(false);
    matchRef.current = "fighting";
    setMatchState("fighting");
    setCallout("BACK ON YOUR FEET!");
    playSound("bell");
  }, [playSound, setEnemyPoseSafe]);

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
    const attemptTimers: number[] = [];
    const failedAttemptCounts = new Set(timer >= 20 ? [4, 6, 8] : [5, 8]);
    const countTimer = window.setInterval(() => {
      const nextCount = count + 1;
      const riseAt = enemyRiseAtRef.current;

      if (riseAt !== null && nextCount >= riseAt) {
        count = nextCount;
        setEnemyCount(count);
        window.clearInterval(countTimer);
        resolutionTimer = window.setTimeout(() => {
          if (matchRef.current !== "enemy-down") return;
          const recoveryHealth = enemyRecoveryHealthRef.current;
          enemyHealthRef.current = recoveryHealth;
          setEnemyHealth(recoveryHealth);
          setEnemyPoseSafe("rising");
          setSecondWind(true);
          setCallout("MOHAWK PUSHES UP FROM HIS KNEE!");
          window.setTimeout(() => {
            if (matchRef.current !== "enemy-down") return;
            const resumeFight = () => {
              if (matchRef.current !== "enemy-down") return;
              matchRef.current = "fighting";
              setMatchState("fighting");
              setEnemyPoseSafe("idle");
              setCallout(`MOHAWK RISES WITH ${recoveryHealth}%!`);
              playSound("bell");
              window.setTimeout(() => setSecondWind(false), 2600);
            };
            if (kneeDepthRef.current === "far") {
              setEnemyPoseSafe("returning");
              setCallout("MOHAWK STEPS BACK INTO RANGE!");
              window.setTimeout(resumeFight, 480);
            } else {
              resumeFight();
            }
          }, 620);
        }, 300);
      } else if (riseAt === null && nextCount >= 10) {
        // Ten is the deadline, not another waiting frame. Keep nine as the
        // final visible number and wave the fight off the instant ten arrives.
        window.clearInterval(countTimer);
        resolutionTimer = window.setTimeout(() => {
          if (matchRef.current === "enemy-down") finishMatch("won");
        }, 80);
      } else {
        count = nextCount;
        setEnemyCount(count);
        if (riseAt === null && failedAttemptCounts.has(count)) {
          setEnemyPoseSafe("failed-rise");
          setCallout(count >= 8 ? "MOHAWK WILLS HIMSELF UP!" : "MOHAWK TRIES TO STAND!");
          attemptTimers.push(window.setTimeout(() => {
            if (matchRef.current === "enemy-down" && poseRef.current === "failed-rise") {
              setEnemyPoseSafe("knockdown-knee");
              setCallout(count >= 8 ? "HE FALLS BACK TO THE KNEE!" : "NOT YET!");
            }
          }, 620));
        }
      }
    }, 800);
    return () => {
      window.clearInterval(countTimer);
      if (resolutionTimer) window.clearTimeout(resolutionTimer);
      attemptTimers.forEach((attemptTimer) => window.clearTimeout(attemptTimer));
    };
  }, [finishMatch, matchState, playSound, setEnemyPoseSafe, timer]);

  useEffect(() => {
    if (matchState !== "fighting") return;
    const ticker = window.setInterval(() => {
      setTimer((value) => {
        if (value <= 1) {
          // This is a championship challenge, not a judges' decision. The
          // player must finish Mohawk before the bell; surviving with a health
          // lead is still a successful title defense for Mohawk.
          finishMatch("lost", "time");
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
    type AttackStyle = "normal" | "heavy" | "flurry" | "uppercut" | "power-combo";
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

    const throwStrike = (combination: EnemyMove[], index: number, style: AttackStyle = "normal") => {
      if (cancelled || matchRef.current !== "fighting") return;
      if (performance.now() < enemyWindedUntilRef.current) {
        later(() => throwStrike(combination, index, style), 240);
        return;
      }
      const move = combination[index];
      const rage = enemyHealthRef.current <= 35;
      const firstPunch = index === 0;
      const comboUppercut = style === "power-combo" && move === "uppercut";
      const comboHaymaker = style === "power-combo" && !comboUppercut;
      const windup = style === "heavy" ? 760
        : comboUppercut ? 250
        : comboHaymaker ? firstPunch ? 430 : 115
        : style === "uppercut" ? 480
        : style === "flurry" ? firstPunch ? 185 : 58
        : firstPunch ? rage ? 240 : move === "body" ? 430 : 340
        : rage ? 90 : move === "body" ? 180 : 130;
      const windupPose: FighterPose = style === "heavy" ? "windup-heavy"
        : comboUppercut ? "windup-uppercut"
        : comboHaymaker ? `windup-combo-${move}` as FighterPose
        : style === "uppercut" ? "windup-uppercut"
        : `windup-${move}` as FighterPose;
      const attackPose: FighterPose = style === "heavy" ? "attack-heavy"
        : comboUppercut ? "attack-uppercut"
        : comboHaymaker ? `attack-combo-${move}` as FighterPose
        : style === "uppercut" ? "attack-uppercut"
        : `attack-${move}` as FighterPose;
      setEnemyPoseSafe(windupPose);
      setCallout(style === "heavy" ? "HAYMAKER — HE RETREATS!" : style === "power-combo" ? comboUppercut ? "COMBO FINISHER!" : "HAYMAKER BARRAGE!" : style === "flurry" ? "VOLUME FLURRY" : style === "uppercut" ? "WATCH THE CENTER" : "PRESSURE");

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
            (style === "heavy" || move === "body" || move === "uppercut" || (move === "left" && dodgeRef.current === "right") || (move === "right" && dodgeRef.current === "left"));

          if (dodged) {
            counterReadyUntilRef.current = performance.now() + (style === "heavy" ? 980 : 720);
            setCallout(style === "heavy" ? "HAYMAKER MISSED — PUNISH HIM!" : "PERFECT SLIP — COUNTER!");
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

          if (style === "heavy") {
            setOverhandImpact(true);
            window.setTimeout(() => setOverhandImpact(false), 190);
          }

          if (blockingRef.current && guardRef.current > 0) {
            const lateBlock = performance.now() - blockStartedAtRef.current < 95;
            const baseGuardCost = style === "heavy" ? 42 : comboUppercut ? 30 : comboHaymaker ? 18 : style === "uppercut" ? 34 : style === "flurry" ? 14 : move === "body" ? 30 : 22;
            const guardCost = baseGuardCost + (lateBlock ? 9 : 0);
            const nextGuard = clamp(guardRef.current - guardCost);
            guardRef.current = nextGuard;
            setGuard(nextGuard);
            const chip = style === "heavy" ? 9 : comboUppercut ? 7 : comboHaymaker ? 4 : style === "uppercut" ? 7 : style === "flurry" ? 2 : move === "body" ? 5 : 3;
            takePlayerDamage(lateBlock ? chip + 4 : chip);
            setCallout(nextGuard <= 0 ? "GUARD BROKEN!" : style === "heavy" ? "HAYMAKER CRUSHES YOUR GUARD!" : lateBlock ? "LATE BLOCK" : "BLOCKED");
            if (nextGuard <= 0) {
              setBlocking(false);
              blockingRef.current = false;
              guardBrokenUntilRef.current = performance.now() + 700;
            }
          } else {
            const damage = style === "heavy" ? 36 : comboUppercut ? 24 : comboHaymaker ? 16 : style === "uppercut" ? 22 : style === "flurry" ? 7 : move === "body" ? 18 : rage ? 17 : 14;
            takePlayerDamage(damage);
            setCallout(style === "heavy" ? "MOHAWK HAYMAKER!" : style === "uppercut" ? "UPPERCUT!" : move === "body" ? "LIVER SHOT!" : "CLEAN HIT");
          }

          if (index + 1 < combination.length) {
            later(() => throwStrike(combination, index + 1, style), style === "flurry" ? 34 : style === "power-combo" ? 75 : rage ? 55 : 85);
          } else {
            later(() => {
              if (matchRef.current === "fighting") {
                setEnemyPoseSafe("idle");
                queueAttack();
              }
            }, rage ? 230 : 360);
          }
        }, style === "heavy" ? 320 : comboUppercut ? 280 : comboHaymaker ? 175 : style === "uppercut" ? 280 : style === "flurry" ? 92 : rage ? 125 : 155);
      }, windup);
    };

    const beginAttack = () => {
      if (cancelled || matchRef.current !== "fighting") return;
      if (performance.now() < enemyWindedUntilRef.current) {
        later(beginAttack, 240);
        return;
      }
      // A counter can leave the fighter in the stunned pose after the hit
      // reaction completes. Never keep re-queuing against that pose forever:
      // visibly recover, then resume offense from a clean idle state.
      if (poseRef.current === "stunned") {
        later(beginAttack, 240);
        return;
      }
      if (poseRef.current.startsWith("hit")) {
        queueAttack();
        return;
      }
      const pattern = Math.random();
      if (pattern < .13) throwStrike(["right", "left", "right", "left", "uppercut"], 0, "power-combo");
      else if (pattern < .28) throwStrike(["right"], 0, "heavy");
      else if (pattern < .44) throwStrike(["left", "right", "left", "right", "left"], 0, "flurry");
      else if (pattern < .58) throwStrike(["uppercut"], 0, "uppercut");
      else throwStrike(chooseCombination(), 0);
    };

    later(queueAttack, 750);
    return () => {
      cancelled = true;
      timers.forEach(window.clearTimeout);
    };
  }, [matchState, playSound, setEnemyPoseSafe, takePlayerDamage]);

  const punch = useCallback((kind: PunchKind): void => {
    if (matchRef.current !== "fighting" || blockingRef.current) return;
    if (kind === "uppercut" && specialRef.current < 100) {
      setCallout("BUILD YOUR SPECIAL!");
      return;
    }
    if (punchLockRef.current) {
      if (kind === "left" || kind === "right" || kind === "body") bufferedPunchRef.current = kind;
      return;
    }
    const cost = kind === "left" ? 6 : kind === "power-jab" ? 12 : kind === "right" ? 9 : kind === "body" ? 11 : kind === "uppercut" ? 18 : 19;
    if (staminaRef.current < cost) {
      setCallout("BREATHE — LOW STAMINA");
      return;
    }

    punchLockRef.current = true;
    const actionId = ++playerActionRef.current;
    const nextStamina = clamp(staminaRef.current - cost);
    staminaRef.current = nextStamina;
    setStamina(nextStamina);
    if (kind === "uppercut") {
      specialRef.current = 0;
      setSpecial(0);
    }
    setPlayerPose(kind === "left" ? "jab-left" : kind === "power-jab" ? "power-jab" : kind === "right" ? "cross-right" : kind === "body" ? "body-hook" : kind === "uppercut" ? "special-uppercut" : "haymaker");

    // Mohawk reads obvious offense and actively closes his guard. A charged
    // haymaker is much easier for him to see coming unless he is stunned.
    const canReadPunch = poseRef.current === "idle" || poseRef.current === "taunt";
    if (canReadPunch && Math.random() < (kind === "haymaker" || kind === "uppercut" ? 0.58 : kind === "power-jab" ? 0.32 : 0.2)) {
      setEnemyPoseSafe("guard");
    }

    // Resolve damage on the extension/contact frame, never on button-down.
    window.setTimeout(() => {
      if (matchRef.current !== "fighting" || playerActionRef.current !== actionId || blockingRef.current) return;
      // Mohawk physically retreats during his haymaker load. The player may
      // swing, but cannot damage or interrupt him until he lunges back in.
      if (poseRef.current === "windup-heavy") {
        setCombo(0);
        setCallout("OUT OF RANGE!");
        playSound("dodge");
        return;
      }
      const enemyIsOpen = poseRef.current === "stunned" || poseRef.current.startsWith("windup");
      const enemyIsGuarding = poseRef.current === "guard";
      const slipCounter = performance.now() <= counterReadyUntilRef.current;
      const base = kind === "left" ? 4 : kind === "power-jab" ? 12 : kind === "right" ? 7 : kind === "body" ? 6 : kind === "uppercut" ? 72 : 43;
      const fullDamage = enemyIsGuarding ? 0 : slipCounter ? Math.round(base * 3.6) : enemyIsOpen ? Math.round(base * (kind === "haymaker" ? 1.25 : 2.1)) : base;
      // Mohawk remains durable across four health bars, but the addition of
      // active guarding made the former one-sixth scaling too restrictive.
      // One-quarter scaling restores a realistic 90-second knockout path.
      const damage = fullDamage / 4;
      const nextHealth = clamp(enemyHealthRef.current - damage);

      if (slipCounter) counterReadyUntilRef.current = 0;

      enemyHealthRef.current = nextHealth;
      setEnemyHealth(nextHealth);
      setCombo((value) => enemyIsGuarding ? 0 : value + 1);
      enemyStunHitsRef.current = enemyIsGuarding ? 0 : enemyStunHitsRef.current + 1;
      const triggersWindedStun = !enemyIsGuarding && nextHealth > 0 && enemyStunHitsRef.current >= 8;
      const triggersStumble = !enemyIsGuarding && !triggersWindedStun && nextHealth > 0 && nextHealth <= 35 && Math.random() < (nextHealth <= 15 ? .38 : .2);
      if (triggersWindedStun) {
        enemyStunHitsRef.current = 0;
        enemyWindedUntilRef.current = performance.now() + 1650;
      } else if (triggersStumble) {
        enemyWindedUntilRef.current = performance.now() + 720;
      }
      if (!enemyIsGuarding) {
        const specialGain = kind === "left" ? 3 : kind === "power-jab" ? 6 : kind === "right" ? 4 : kind === "body" ? 5 : kind === "haymaker" ? 7 : 0;
        const nextSpecial = clamp(specialRef.current + specialGain + (slipCounter ? 4 : 0));
        specialRef.current = nextSpecial;
        setSpecial(nextSpecial);
      }
      setScore((value) => value + damage * 100 + (slipCounter ? 900 : enemyIsOpen ? 350 : kind === "haymaker" && !enemyIsGuarding ? 1200 : 0));
      setImpact(enemyIsGuarding ? null : kind === "haymaker" || kind === "uppercut" || kind === "power-jab" ? "right" : kind);
      setHitStop(true);
      setScreenShake(true);
      setEnemyPoseSafe(enemyIsGuarding ? "guard" : triggersWindedStun ? "stunned" : triggersStumble ? "stumble-back" : kind === "left" || kind === "power-jab" ? "hit-right" : kind === "right" || kind === "haymaker" || kind === "uppercut" ? "hit-left" : "hit-body");
      playSound("punch");
      setCallout(enemyIsGuarding ? kind === "haymaker" || kind === "uppercut" ? "POWER SHOT BLOCKED!" : "MOHAWK BLOCKS!" : triggersWindedStun ? "MOHAWK IS WINDED!" : triggersStumble ? "MOHAWK STUMBLES BACK!" : slipCounter ? `SLIP COUNTER +${damage}` : enemyIsOpen ? `COUNTER +${damage}` : kind === "uppercut" ? "SPECIAL UPPERCUT!" : kind === "haymaker" ? "HAYMAKER!" : kind === "power-jab" ? "POWER JAB!" : kind === "body" ? "BODY SHOT" : "CONNECTS");
      const heavyImpact = slipCounter || kind === "haymaker" || kind === "uppercut" || kind === "power-jab";
      window.setTimeout(() => setHitStop(false), heavyImpact ? 88 : 52);
      window.setTimeout(() => setScreenShake(false), heavyImpact ? 135 : 82);
      window.setTimeout(() => setImpact(null), heavyImpact ? 180 : 120);
      if (triggersWindedStun) {
        window.setTimeout(() => {
          if (matchRef.current === "fighting" && performance.now() >= enemyWindedUntilRef.current) {
            setEnemyPoseSafe("idle");
            setCallout("MOHAWK RECOVERS");
          }
        }, 1650);
      } else if (triggersStumble) {
        window.setTimeout(() => {
          if (matchRef.current === "fighting" && performance.now() >= enemyWindedUntilRef.current) setEnemyPoseSafe("idle");
        }, 740);
      }

      if (enemyIsGuarding && kind === "haymaker") {
        // The blocked haymaker leaves the player fully committed. Mohawk
        // answers immediately with a damaging heavy counter animation.
        window.setTimeout(() => {
          if (matchRef.current !== "fighting") return;
          setEnemyPoseSafe("attack-heavy");
          window.setTimeout(() => {
            if (matchRef.current !== "fighting" || poseRef.current !== "attack-heavy") return;
            setImpact("player");
            setScreenShake(true);
            takePlayerDamage(29);
            playSound("hurt");
            setCallout("PUNISHED!");
            window.setTimeout(() => setImpact(null), 160);
            window.setTimeout(() => setScreenShake(false), 180);
            window.setTimeout(() => {
              if (matchRef.current === "fighting" && poseRef.current === "attack-heavy") setEnemyPoseSafe("idle");
            }, 260);
          }, 125);
        }, 110);
      }

      if (nextHealth <= 0) {
        const knockdowns = enemyKnockdownsRef.current + 1;
        enemyKnockdownsRef.current = knockdowns;
        setEnemyKnockdowns(knockdowns);
        const laterKneeRecovery = knockdowns >= 3 && Math.random() < .5;
        const plan = knockdowns === 1
          ? { health: 75, min: 2, max: 4 }
          : knockdowns === 2
            ? { health: 50, min: 4, max: 6 }
            : laterKneeRecovery
              ? { health: 24, min: 6, max: 8 }
              : undefined;
        const riseAt = plan ? plan.min + Math.floor(Math.random() * (plan.max - plan.min + 1)) : null;
        enemyRiseAtRef.current = riseAt;
        enemyRecoveryHealthRef.current = plan?.health ?? 0;
        const nextKneeDepth: KneeDepth =
          kind === "uppercut" || kind === "haymaker"
            ? Math.random() < .68 ? "far" : "near"
            : Math.random() < .3 ? "far" : "near";
        kneeDepthRef.current = nextKneeDepth;
        setKneeDepth(nextKneeDepth);
        setEnemyRiseAt(riseAt);
        setEnemyCount(1);
        ++playerActionRef.current;
        punchLockRef.current = false;
        bufferedPunchRef.current = null;
        setPlayerPose("idle");
        setSecondWind(Boolean(plan));
        matchRef.current = "enemy-down";
        setMatchState("enemy-down");
        playSound("ko");
        // Preserve the punch-specific impact art for a beat before changing
        // to the separate sustained one-knee breathing pose.
        window.setTimeout(() => {
          if (matchRef.current !== "enemy-down") return;
          setEnemyPoseSafe("knockdown-knee");
          setCallout(plan ? "MOHAWK WOBBLES TO A KNEE!" : "MOHAWK CANNOT FIND HIS FEET!");
        }, 260);
        return;
      }

      window.setTimeout(() => {
        if (matchRef.current !== "fighting") return;
        const rage = enemyHealthRef.current <= 35;
        if (Math.random() < (rage ? 0.48 : 0.32)) {
          setEnemyPoseSafe("guard");
          window.setTimeout(() => {
            if (matchRef.current === "fighting" && poseRef.current === "guard") setEnemyPoseSafe("idle");
          }, rage ? 380 : 560);
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
      }, enemyIsOpen ? 220 : kind === "left" ? 145 : kind === "power-jab" ? 210 : kind === "right" ? 210 : kind === "haymaker" || kind === "uppercut" ? 300 : 220);
    }, kind === "left" ? 72 : kind === "power-jab" ? 112 : kind === "right" ? 98 : kind === "haymaker" ? 155 : kind === "uppercut" ? 145 : 105);

    // Retract before accepting the buffered strike. Keeping the lock active
    // during this short guard frame guarantees a full extension on every hit,
    // even when the same punch button is being spammed.
    window.setTimeout(() => {
      if (matchRef.current === "fighting" && !blockingRef.current && playerActionRef.current === actionId) {
        setPlayerPose("idle");
      }
    }, kind === "left" ? 145 : kind === "power-jab" ? 220 : kind === "haymaker" ? 310 : kind === "uppercut" ? 330 : 175);

    window.setTimeout(() => {
      punchLockRef.current = false;
      const buffered = bufferedPunchRef.current;
      bufferedPunchRef.current = null;
      if (buffered && matchRef.current === "fighting" && !blockingRef.current) punchRef.current(buffered);
    }, kind === "left" ? 205 : kind === "power-jab" ? 285 : kind === "haymaker" ? 390 : kind === "uppercut" ? 420 : 235);
  }, [playSound, setEnemyPoseSafe, takePlayerDamage]);

  useEffect(() => void (punchRef.current = punch), [punch]);

  const beginJabCharge = useCallback(() => {
    if (matchRef.current !== "fighting" || blockingRef.current || dodgeRef.current || jabChargingRef.current) return;
    if (punchLockRef.current) {
      bufferedPunchRef.current = "left";
      return;
    }
    if (staminaRef.current < 12) {
      setCallout("BREATHE — LOW STAMINA");
      return;
    }
    punchLockRef.current = true;
    jabChargingRef.current = true;
    jabChargeStartedRef.current = performance.now();
    ++playerActionRef.current;
    setJabCharging(true);
    setPlayerPose("power-jab-charge");
    window.clearTimeout(jabChargeTimerRef.current);
    jabChargeTimerRef.current = window.setTimeout(() => {
      if (jabChargingRef.current && matchRef.current === "fighting") setCallout("POWER JAB READY!");
    }, 410);
  }, []);

  const releaseJabCharge = useCallback(() => {
    if (!jabChargingRef.current) return;
    const heldFor = performance.now() - jabChargeStartedRef.current;
    window.clearTimeout(jabChargeTimerRef.current);
    jabChargingRef.current = false;
    setJabCharging(false);
    punchLockRef.current = false;
    if (matchRef.current !== "fighting" || blockingRef.current) return;
    setPlayerPose("idle");
    punch(heldFor >= 380 ? "power-jab" : "left");
  }, [punch]);

  const beginCrossCharge = useCallback(() => {
    if (matchRef.current !== "fighting" || blockingRef.current || dodgeRef.current || crossChargingRef.current) return;
    if (punchLockRef.current) {
      bufferedPunchRef.current = "right";
      return;
    }
    if (staminaRef.current < 19) {
      setCallout("BREATHE — LOW STAMINA");
      return;
    }

    punchLockRef.current = true;
    crossChargingRef.current = true;
    crossChargeStartedRef.current = performance.now();
    ++playerActionRef.current;
    setHaymakerCharging(true);
    setPlayerPose("haymaker-charge");
    setCallout("LOADING HAYMAKER...");
    window.clearTimeout(crossChargeTimerRef.current);
    crossChargeTimerRef.current = window.setTimeout(() => {
      if (crossChargingRef.current && matchRef.current === "fighting") setCallout("HAYMAKER READY!");
    }, 480);
  }, []);

  const releaseCrossCharge = useCallback(() => {
    if (!crossChargingRef.current) return;
    const heldFor = performance.now() - crossChargeStartedRef.current;
    window.clearTimeout(crossChargeTimerRef.current);
    crossChargingRef.current = false;
    setHaymakerCharging(false);
    window.clearTimeout(jabChargeTimerRef.current);
    jabChargingRef.current = false;
    setJabCharging(false);
    punchLockRef.current = false;

    if (matchRef.current !== "fighting" || blockingRef.current) return;
    setPlayerPose("idle");
    // A tap remains the familiar quick cross. Holding beyond the commitment
    // threshold converts the same input into a risky charged haymaker.
    punch(heldFor >= 430 ? "haymaker" : "right");
  }, [punch]);

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
    window.clearTimeout(crossChargeTimerRef.current);
    crossChargingRef.current = false;
    setHaymakerCharging(false);
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
      if (key === "escape" && (matchRef.current === "fighting" || matchRef.current === "paused")) {
        event.preventDefault();
        togglePause();
      } else if (matchRef.current === "paused") {
        event.preventDefault();
      } else if (matchRef.current === "player-down") {
        event.preventDefault();
        attemptGetUp();
      } else if (matchRef.current === "intro" && (key === "enter" || key === " ")) {
        event.preventDefault();
        startMatch();
      } else if (key === "a" || key === "arrowleft") dodge("left");
      else if (key === "d" || key === "arrowright") dodge("right");
      else if (key === "j") beginJabCharge();
      else if (key === "k") beginCrossCharge();
      else if (key === "l") punch("body");
      else if (key === "u") punch("uppercut");
      else if (key === " ") {
        event.preventDefault();
        beginBlock();
      }
    };
    const up = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      if (key === " ") endBlock();
      else if (key === "k") releaseCrossCharge();
      else if (key === "j") releaseJabCharge();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [attemptGetUp, beginBlock, beginCrossCharge, beginJabCharge, dodge, endBlock, punch, releaseCrossCharge, releaseJabCharge, startMatch, togglePause]);

  const timerText = `${Math.floor(timer / 60)}:${String(timer % 60).padStart(2, "0")}`;
  const rage = enemyHealth <= 35 && enemyHealth > 0;
  const damageTier = enemyHealth <= 25 ? 3 : enemyHealth <= 50 ? 2 : enemyHealth <= 75 ? 1 : 0;
  const visionClass = playerHealth <= 20 ? "vision-critical" : playerHealth <= 40 ? "vision-hurt" : "";
  const loadingProgress = Math.round((loadedAssetCount / POSE_ASSETS.length) * 100);
  const opponentAsset = enemyPose === "windup-left"
    ? asset("/opponent-windup-left.webp")
    : enemyPose === "windup-combo-left"
      ? asset("/opponent-windup-left.webp")
    : enemyPose === "attack-left"
      ? asset("/opponent-punch-left.webp")
      : enemyPose === "attack-combo-left"
        ? asset("/opponent-punch-left.webp")
      : enemyPose === "windup-right"
        ? asset("/opponent-windup-right.webp")
        : enemyPose === "windup-combo-right"
          ? asset("/opponent-windup-right.webp")
        : enemyPose === "attack-right"
          ? asset("/opponent-punch-right.webp")
          : enemyPose === "attack-combo-right"
            ? asset("/opponent-punch-right.webp")
          : enemyPose === "windup-body"
            ? asset("/opponent-body-windup.webp")
            : enemyPose === "attack-body"
              ? asset("/opponent-body-punch.webp")
              : enemyPose === "windup-heavy"
                ? asset("/opponent-windup-right.webp")
                : enemyPose === "attack-heavy"
                  ? asset("/opponent-overhand-right.webp")
                  : enemyPose === "windup-uppercut"
                    ? asset("/opponent-uppercut-windup.webp")
                    : enemyPose === "attack-uppercut"
                      ? asset("/opponent-uppercut.webp")
                      : enemyPose === "taunt"
                        ? asset("/opponent-taunt.webp")
                        : enemyPose === "stumble-back"
                          ? asset("/opponent-hit-cross.webp")
                          : enemyPose === "knockdown-knee" || enemyPose === "rising" || enemyPose === "failed-rise"
                            ? asset("/opponent-knee-breathing.webp")
                        : enemyPose === "hit-right"
                          ? asset("/opponent-hit-jab.webp")
                          : enemyPose === "hit-left"
                            ? asset("/opponent-hit-cross.webp")
                            : enemyPose === "hit-body"
                              ? asset("/opponent-hit-body.webp")
              : asset("/opponent-guard.webp");
  const leftArmAsset = playerPose === "jab-left" || playerPose === "power-jab"
    ? asset("/player-jab-left-arm.webp")
    : playerPose === "body-hook"
      ? asset("/player-body-left-arm.webp")
      : asset("/player-guard-left.webp");
  const rightArmAsset = playerPose === "cross-right" || playerPose === "haymaker"
    ? asset("/player-cross-right-arm.webp")
    : asset("/player-guard-right.webp");

  return (
    <main className={`game-shell ${performanceMode ? "is-performance" : ""} ${screenShake ? "is-shaking" : ""} ${hitStop ? "is-hit-stop" : ""} ${visionClass}`}>
      <section className={`arena ${matchState === "fighting" ? "is-live" : ""}`} aria-label="Bare knuckle boxing ring">
        <div className="grain" aria-hidden="true" />
        <div className="vision-damage" aria-hidden="true"><i /><b /></div>
        <div className="ceiling-lights" aria-hidden="true"><i /><i /><i /></div>
        <div className={`crowd ${secondWind ? "is-chanting" : ""}`} aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => <i key={index} />)}
          <div className="crowd-chant">
            {Array.from({ length: 6 }).map((_, index) => <span key={index}>MO—HAWK!</span>)}
          </div>
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
            <div className={`mini-meter special-meter ${special >= 100 ? "is-ready" : ""}`}><em>{special >= 100 ? "SPECIAL READY" : "SPECIAL"}</em><i style={{ width: `${special}%` }} /></div>
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
        {matchState === "fighting" && <button className="pause-trigger" onClick={togglePause} aria-label="Pause fight">Ⅱ</button>}

        <div className={`opponent-stage pose-${enemyPose} damage-tier-${damageTier} ${enemyPose === "knockdown-knee" || enemyPose === "rising" || enemyPose === "failed-rise" ? `knee-${kneeDepth}` : ""} ${playerPose === "special-uppercut" ? "is-special-contact-hidden" : ""} ${rage ? "is-raging" : ""} ${secondWind && matchState !== "enemy-down" ? "is-second-wind" : ""}`}>
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
        {overhandImpact && <img className="overhand-impact" src={asset("/opponent-overhand-impact.webp")} alt="" aria-hidden="true" draggable={false} />}
        {playerPose === "special-uppercut" && matchState === "fighting" && (
          <img className="special-uppercut-contact" src={asset("/player-special-uppercut-contact.webp")} alt="The player's right uppercut connecting beneath Mohawk's chin" draggable={false} />
        )}

        {haymakerCharging && matchState === "fighting" && (
          <div className="haymaker-charge-meter" aria-live="polite"><span /><b>HAYMAKER</b></div>
        )}
        {jabCharging && matchState === "fighting" && (
          <div className="jab-charge-meter" aria-live="polite"><span /><b>POWER JAB</b></div>
        )}

        {matchState !== "won" && matchState !== "lost" && (
          <div className={`first-person-body player-${playerPose}`} aria-hidden="true">
            {playerPose === "hit" ? (
              <img className="player-pose-art player-hit-art" src={asset("/player-hit.webp")} alt="" draggable={false} />
            ) : (
              <>
                <img className="player-pose-art player-arm-art player-left-art" src={leftArmAsset} alt="" draggable={false} />
                <img className="player-pose-art player-arm-art player-right-art" src={rightArmAsset} alt="" draggable={false} />
              </>
            )}
            <img className="player-pose-art player-block-art" src={asset("/player-block.webp")} alt="" draggable={false} />
          </div>
        )}

        {matchState === "fighting" && (
          <div className="controls" aria-label="Fight controls">
            <div className="move-controls">
              <button onPointerDown={(event) => { event.preventDefault(); dodge("left"); }} aria-label="Dodge left"><kbd>A</kbd><span>SLIP LEFT</span></button>
              <button onPointerDown={(event) => { event.preventDefault(); dodge("right"); }} aria-label="Dodge right"><kbd>D</kbd><span>SLIP RIGHT</span></button>
            </div>
            <div className="punch-controls">
              <button
                className={jabCharging ? "jab-button is-charging" : "jab-button"}
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginJabCharge(); }}
                onPointerUp={releaseJabCharge}
                onPointerLeave={releaseJabCharge}
                onPointerCancel={releaseJabCharge}
                aria-label="Tap for left jab, hold for power jab"
              ><kbd>J</kbd><span>JAB / HOLD</span></button>
              <button onPointerDown={(event) => { event.preventDefault(); punch("body"); }} aria-label="Body hook"><kbd>L</kbd><span>BODY</span></button>
              <button
                className={haymakerCharging ? "cross-button is-charging" : "cross-button"}
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginCrossCharge(); }}
                onPointerUp={releaseCrossCharge}
                onPointerLeave={releaseCrossCharge}
                onPointerCancel={releaseCrossCharge}
                aria-label="Tap for right cross, hold for haymaker"
              ><kbd>K</kbd><span>CROSS / HOLD</span></button>
              <button
                className={`special-button ${special >= 100 ? "is-ready" : ""}`}
                onPointerDown={(event) => { event.preventDefault(); punch("uppercut"); }}
                disabled={special < 100}
                aria-label="Finishing uppercut when special meter is full"
              ><kbd>U</kbd><span>SPECIAL</span></button>
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

        {paused && matchState === "paused" && (
          <div className="overlay pause-overlay" role="dialog" aria-modal="true" aria-label="Fight paused">
            <div className="pause-card">
              <img className="pause-logo" src={asset("/fighttime-logo.png")} alt="FightTime" draggable={false} />
              <div className="pause-rules">
                <section><strong>RAGE MODE</strong><span>Below 35% health, Mohawk attacks faster, hits harder, guards more often, and recovers sooner.</span></section>
                <section><strong>CHARGED SHOTS</strong><span>Hold J for a power jab. Hold K for a haymaker. A blocked haymaker invites a heavy counter.</span></section>
                <section><strong>SPECIAL</strong><span>Landed punches fill the purple meter. At 100%, press U for the finishing uppercut.</span></section>
                <section><strong>DEFENSE</strong><span>Hold Space to block. Slip with A/D; a successful slip powers up your next counter.</span></section>
                <section><strong>MOHAWK&apos;S KNEES</strong><span>He does not fall flat. He may stumble or take a knee. From the third knee onward, every rise is a 50/50 fight.</span></section>
              </div>
              <button className="fight-button" onClick={togglePause}>RETURN TO FIGHT <i>›</i></button>
              <small>PRESS ESC TO RESUME</small>
            </div>
          </div>
        )}

        {matchState === "enemy-down" && (
          <div className="enemy-count-overlay" aria-live="assertive">
            <p>MOHAWK TAKES A KNEE · {enemyKnockdowns}</p>
            <strong>{enemyCount}</strong>
            <span>{enemyRiseAt === null ? "THE FINAL COUNT" : `CAN HE RISE?`}</span>
          </div>
        )}

        {matchState === "intro" && !assetsReady && (
          <div className="overlay preload-overlay" role="status" aria-live="polite" aria-label={`Loading fight assets, ${loadingProgress}% complete`}>
            <div className="preload-lockup">
              <img className="preload-logo" src={asset("/fighttime-logo.png")} alt="FightTime" draggable={false} />
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
            <img className="intro-mohawk" src={asset("/opponent-guard.webp")} alt="The Mohawk waiting in the ring" draggable={false} />
            <div className="title-lockup">
              <img className="intro-logo" src={asset("/fighttime-logo.png")} alt="FightTime" draggable={false} />
            </div>
            <div className="intro-versus-card">
              <div className="versus-row"><strong>YOU</strong><b>VS</b><strong>THE MOHAWK</strong></div>
              <p>IRON JAW · PRESSURE FIGHTER · RAPID FIRE</p>
              <div className="how-to">
                <div><kbd>A</kbd><kbd>D</kbd><span>SLIP</span></div>
                <div><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd><span>STRIKE</span></div>
                <div><kbd>SPACE</kbd><span>BLOCK</span></div>
              </div>
              <button className="fight-button intro-fight-button" onClick={startMatch}>ENTER THE RING <i>›</i></button>
              <small>1 ROUND · 90 SECONDS · SURVIVE THE STORM</small>
            </div>
          </div>
        )}

        {(matchState === "won" || matchState === "lost") && (
          <div className={`overlay result-overlay ${matchState}`}>
            {matchState === "lost" ? (
              <>
                <div className="defeat-scene" aria-hidden="true">
                  <div className="victory-mohawk-stage">
                    <img className="victory-mohawk victory-both" src={asset("/opponent-victory.webp")} alt="" draggable={false} />
                    <img className="victory-mohawk victory-left" src={asset("/opponent-victory-left.webp")} alt="" draggable={false} />
                    <img className="victory-mohawk victory-right" src={asset("/opponent-victory-right.webp")} alt="" draggable={false} />
                  </div>
                  {resultReason === "knockout" && <img className="defeated-player" src={asset("/player-hit.webp")} alt="" draggable={false} />}
                </div>
                {resultReason === "time" && (
                  <div className="timeout-mohawk-speech">Wooo! That was fun. Wanna try again?</div>
                )}
                <div className={`defeat-copy ${resultReason === "time" ? "time-result" : ""}`}>
                  <p>{resultReason === "time" ? "OFFICIAL RESULT · TIME LIMIT" : "OFFICIAL RESULT · KNOCKOUT"}</p>
                  {resultReason === "time" ? (
                    <h2><span>TIME'S UP!</span><small>MOHAWK WINS</small></h2>
                  ) : (
                    <h2>THE MOHAWK WINS</h2>
                  )}
                  <div className="result-stats">
                    <span><em>SCORE</em><strong>{score.toLocaleString()}</strong></span>
                    <span><em>KNOCKDOWNS</em><strong>{playerKnockdowns}</strong></span>
                    <span><em>TIME</em><strong>{timerText}</strong></span>
                  </div>
                  {showRematch ? (
                    <div className="result-actions">
                      <button className="fight-button rematch-button" onClick={startMatch}>FIGHT AGAIN <i>↻</i></button>
                      <button className="fight-button menu-button" onClick={returnToMenu}>MAIN MENU <i>‹</i></button>
                    </div>
                  ) : (
                    <div className="victory-delay" role="status">MOHAWK CELEBRATES...</div>
                  )}
                </div>
              </>
            ) : (
              <div className="champion-screen">
                <div className="gold-confetti" aria-hidden="true">
                  {Array.from({ length: 32 }).map((_, index) => <i key={index} />)}
                </div>
                <div className="sportsmanship-group">
                  <img className="sportsmanship-mohawk" src={asset("/opponent-sportsmanship.webp")} alt="Mohawk smiling after a great fight despite a black eye and cuts" draggable={false} />
                  <div className="mohawk-speech">
                    <strong>MOHAWK</strong>
                    <p>Great fight! I&apos;ll be back for a rematch soon.</p>
                  </div>
                </div>
                <img className="player-holds-belt" src={asset("/player-holds-belt.webp")} alt="The player holding the gold championship belt" draggable={false} />
                <div className="champion-copy">
                  <p>MOHAWK COULD NOT RISE · TEN COUNT</p>
                  <h2>YOU DEFEATED<br /><span>THE MOHAWK</span></h2>
                  <h3>GRIT CITY CHAMPION</h3>
                  <div className="result-stats">
                    <span><em>SCORE</em><strong>{score.toLocaleString()}</strong></span>
                    <span><em>KNEE COUNTS</em><strong>{enemyKnockdowns}</strong></span>
                    <span><em>TIME</em><strong>{timerText}</strong></span>
                  </div>
                  {showRematch ? (
                    <div className="result-actions">
                      <button className="fight-button rematch-button" onClick={startMatch}>DEFEND THE TITLE <i>↻</i></button>
                      <button className="fight-button menu-button" onClick={returnToMenu}>MAIN MENU <i>‹</i></button>
                    </div>
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
