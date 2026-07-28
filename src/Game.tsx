"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

type MatchState = "intro" | "countdown" | "fighting" | "paused" | "player-down" | "enemy-down" | "finisher" | "mohawk-finisher" | "won" | "lost";
type FighterPose =
  | "idle"
  | "windup-left"
  | "windup-right"
  | "windup-body"
  | "windup-heavy"
  | "windup-heavy-left"
  | "windup-haymaker-right"
  | "windup-haymaker-left"
  | "windup-combo-left"
  | "windup-combo-right"
  | "windup-uppercut"
  | "attack-left"
  | "attack-right"
  | "attack-body"
  | "attack-heavy"
  | "attack-heavy-left"
  | "attack-haymaker-right"
  | "attack-haymaker-left"
  | "attack-heavy-contact"
  | "attack-heavy-left-contact"
  | "attack-haymaker-right-contact"
  | "attack-haymaker-left-contact"
  | "attack-left-contact"
  | "attack-right-contact"
  | "attack-body-contact"
  | "attack-uppercut-contact"
  | "attack-combo-left"
  | "attack-combo-right"
  | "attack-uppercut"
  | "taunt"
  | "guard"
  | "hit-left"
  | "hit-right"
  | "hit-body"
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
  | "left-haymaker"
  | "right-haymaker"
  | "left-uppercut"
  | "right-hook"
  | "body-hook"
  | "special-uppercut"
  | "dodge-left"
  | "dodge-right"
  | "block"
  | "hit";
type DodgeDirection = "left" | "right" | null;
type ResultReason = "knockout" | "time";
type DragonFatalityFrame = `fatality-${"01" | "02" | "03" | "04" | "05" | "06" | "07"}`;
type MohawkFinisherFrame =
  | DragonFatalityFrame
  | "chair-slide" | "chair-charge" | "chair-impact" | "chair-aftermath"
  | "brotality-enter" | "brotality-run" | "brotality-windup" | "brotality-impact" | "brotality-victory";
type PunchKind = "left" | "power-jab" | "right" | "body" | "haymaker" | "left-haymaker" | "right-haymaker" | "left-uppercut" | "right-hook" | "uppercut";
type KneeDepth = "near" | "far";
type Venue = "arena" | "tulip-street" | "blue-bridge" | "madison-square-garden";
type UnlockableVenue = Exclude<Venue, "arena">;
type SecretEffect =
  | "flameon" | "ironjaw" | "timeless" | "aura" | "fatality"
  | "brotality" | "slowmo" | "arcade" | "rumble" | "savage";
type PunchStats = {
  jab: number;
  cross: number;
  body: number;
  leftUppercut: number;
  rightHook: number;
  powerJab: number;
  haymaker: number;
  specialUppercut: number;
};
type LeaderboardEntry = {
  initials: string;
  score: number;
  date: string;
  version: string;
};

const MAX_HEALTH = 100;
const ROUND_TIME = 90;
const PLAYER_KNOCKDOWN_SCORE_PENALTY = 3000;
const TIME_BONUS_PER_SECOND = 200;
const LEADERBOARD_STORAGE_KEY = "fighttime-local-leaderboard-v1";
const VENUE_UNLOCKS_STORAGE_KEY = "fighttime-venue-unlocks-v2";
const EMPTY_PUNCH_STATS: PunchStats = {
  jab: 0,
  cross: 0,
  body: 0,
  leftUppercut: 0,
  rightHook: 0,
  powerJab: 0,
  haymaker: 0,
  specialUppercut: 0,
};
const PUNCH_POINTS: Record<keyof PunchStats, number> = {
  jab: 100,
  cross: 150,
  body: 150,
  leftUppercut: 200,
  rightHook: 200,
  powerJab: 250,
  haymaker: 400,
  specialUppercut: 750,
};
const GAME_VERSION = "0.88.3";
const asset = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
const VENUES: readonly { id: Venue; label: string; background?: string; achievement?: string }[] = [
  { id: "arena", label: "FIGHTTIME ARENA" },
  { id: "tulip-street", label: "TULIP STREET", background: "/venue-tulip-street.webp", achievement: "WIN WITH 3 OR FEWER KNOCKDOWNS" },
  { id: "blue-bridge", label: "BLUE BRIDGE", background: "/venue-blue-bridge.webp", achievement: "WIN 1 FIGHT" },
  { id: "madison-square-garden", label: "MADISON SQUARE GARDEN", background: "/venue-madison-square-garden.webp", achievement: "WIN WITH THE SPECIAL UPPERCUT" },
];
const EMPTY_VENUE_UNLOCKS: Record<UnlockableVenue, boolean> = {
  "tulip-street": false,
  "blue-bridge": false,
  "madison-square-garden": false,
};

// Only assets required during normal combat block the loading screen. Result
// scenes and secret finishers are loaded on demand so Chrome can reclaim their
// decoded image memory instead of pinning the entire game at startup.
const CORE_POSE_ASSETS = [
  asset("/opponent-guard.webp"), asset("/opponent-windup-left.webp"), asset("/opponent-punch-left.webp"),
  asset("/opponent-windup-right.webp"), asset("/opponent-punch-right.webp"),
  asset("/opponent-overhand-contact.webp"),
  asset("/opponent-haymaker-right-contact.webp"), asset("/opponent-haymaker-left-contact.webp"),
  asset("/opponent-jab-contact.webp"), asset("/opponent-cross-contact.webp"),
  asset("/opponent-body-contact.webp"), asset("/opponent-uppercut-contact.webp"),
  asset("/opponent-body-windup.webp"), asset("/opponent-body-punch.webp"),
  asset("/opponent-uppercut-windup.webp"), asset("/opponent-uppercut.webp"), asset("/opponent-taunt.webp"),
  asset("/opponent-hit-jab.webp"), asset("/opponent-hit-cross.webp"), asset("/opponent-hit-body.webp"),
  asset("/opponent-knee-breathing.webp"), asset("/opponent-knee-rising.webp"),
  asset("/player-guard-left-v2.webp"), asset("/player-guard-right-v2.webp"), asset("/player-jab-left-arm.webp"),
  asset("/player-cross-right-arm.webp"), asset("/player-body-left-arm.webp"),
  asset("/player-haymaker-left-arm.webp"), asset("/player-haymaker-right-arm.webp"),
  asset("/player-left-uppercut-arm.webp"), asset("/player-right-hook-arm.webp"),
  asset("/player-power-jab.webp"), asset("/player-special-uppercut.webp"), asset("/player-special-uppercut-contact.webp"),
  asset("/player-block.webp"), asset("/player-hit.webp"),
  asset("/player-knockdown-arms.webp"),
];

const SAVAGE_ASSETS = [
  asset("/savage-guard.webp"), asset("/savage-windup-left.webp"), asset("/savage-windup-right.webp"),
  asset("/savage-punch-left.webp"), asset("/savage-punch-right.webp"), asset("/savage-body.webp"),
  asset("/savage-heavy.webp"), asset("/savage-hit.webp"), asset("/savage-knee.webp"),
  asset("/savage-special-uppercut-contact.webp"),
];

const FATALITY_ASSETS = [
  asset("/mohawk-fatality-simple.webp"),
];

const BROTALITY_ASSETS = [
  asset("/mohawk-finisher-chair-slide.png"), asset("/mohawk-finisher-chair-charge.png"),
  asset("/mohawk-finisher-chair-impact.png"), asset("/mohawk-finisher-chair-aftermath.png"),
  asset("/mohawk-finisher-brotality-enter.webp"), asset("/mohawk-finisher-brotality-run.webp"),
  asset("/mohawk-finisher-brotality-windup.webp"), asset("/mohawk-finisher-brotality-impact.webp"),
  asset("/mohawk-finisher-brotality-victory.webp"),
];

const PLAYER_FINISHER_ASSETS = [
  asset("/finisher-wobble.png"),
  asset("/finisher-groin-kick.png"), asset("/finisher-groin-recoil.png"),
  asset("/finisher-groin-kneel.png"), asset("/finisher-groin-knee.png"), asset("/finisher-groin-down.png"),
  asset("/finisher-powerbomb-kick.png"), asset("/finisher-powerbomb-head-pull.png"),
  asset("/finisher-powerbomb-lift.png"), asset("/finisher-powerbomb-impact.png"),
];

const warmAssets = (sources: readonly string[]) => {
  sources.forEach((src) => {
    const image = new Image();
    image.decoding = "async";
    image.src = src;
    void image.decode().catch(() => undefined);
  });
};

function savageAssetForPose(pose: FighterPose) {
  if (
    pose === "windup-left" ||
    pose === "windup-combo-left" ||
    pose === "windup-heavy-left" ||
    pose === "windup-haymaker-left"
  ) return asset("/savage-windup-left.webp");
  if (
    pose === "windup-right" ||
    pose === "windup-combo-right" ||
    pose === "windup-heavy" ||
    pose === "windup-haymaker-right" ||
    pose === "windup-uppercut"
  ) return asset("/savage-windup-right.webp");
  if (
    pose === "attack-left" ||
    pose === "attack-combo-left" ||
    pose === "attack-left-contact" ||
    pose === "attack-heavy-left" ||
    pose === "attack-heavy-left-contact" ||
    pose === "attack-haymaker-left" ||
    pose === "attack-haymaker-left-contact"
  ) return asset("/savage-punch-left.webp");
  if (
    pose === "attack-right" ||
    pose === "attack-combo-right" ||
    pose === "attack-right-contact"
  ) return asset("/savage-punch-right.webp");
  if (pose === "windup-body" || pose === "attack-body" || pose === "attack-body-contact") {
    return asset("/savage-body.webp");
  }
  if (
    pose === "attack-heavy" ||
    pose === "attack-heavy-contact" ||
    pose === "attack-haymaker-right" ||
    pose === "attack-haymaker-right-contact" ||
    pose === "attack-uppercut" ||
    pose === "attack-uppercut-contact"
  ) return asset("/savage-heavy.webp");
  if (
    pose === "hit-left" ||
    pose === "hit-right" ||
    pose === "hit-body" ||
    pose === "stumble-back" ||
    pose === "knockout"
  ) return asset("/savage-hit.webp");
  if (pose === "knockdown-knee" || pose === "rising" || pose === "failed-rise") {
    return asset("/savage-knee.webp");
  }
  return asset("/savage-guard.webp");
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}

function statKeyForPunch(kind: PunchKind): keyof PunchStats {
  if (kind === "left") return "jab";
  if (kind === "right") return "cross";
  if (kind === "body") return "body";
  if (kind === "left-uppercut") return "leftUppercut";
  if (kind === "right-hook") return "rightHook";
  if (kind === "power-jab") return "powerJab";
  if (kind === "uppercut") return "specialUppercut";
  return "haymaker";
}

function calculatePunchScore(stats: PunchStats) {
  return (Object.keys(stats) as (keyof PunchStats)[])
    .reduce((total, key) => total + stats[key] * PUNCH_POINTS[key], 0);
}

export default function Home() {
  const [matchState, setMatchState] = useState<MatchState>("intro");
  const [paused, setPaused] = useState(false);
  const [enemyHealth, setEnemyHealth] = useState(MAX_HEALTH);
  const [playerHealth, setPlayerHealth] = useState(MAX_HEALTH);
  const [stamina, setStamina] = useState(100);
  const [guard, setGuard] = useState(100);
  const [timer, setTimer] = useState(ROUND_TIME);
  const [fightCountdown, setFightCountdown] = useState(3);
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
  const [kneeDepth, setKneeDepth] = useState<KneeDepth>("near");
  const [punchStats, setPunchStats] = useState<PunchStats>(EMPTY_PUNCH_STATS);
  const [comboScoreBonus, setComboScoreBonus] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [initials, setInitials] = useState("");
  const [awaitingInitials, setAwaitingInitials] = useState(false);
  const [leaderboardSubmitted, setLeaderboardSubmitted] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [flamingHands, setFlamingHands] = useState(false);
  const [ironJaw, setIronJaw] = useState(false);
  const [endlessFight, setEndlessFight] = useState(false);
  const [aura, setAura] = useState(false);
  const [finisherEnabled, setFinisherEnabled] = useState(false);
  const [brotalityEnabled, setBrotalityEnabled] = useState(false);
  const [slowMo, setSlowMo] = useState(false);
  const [arcadeMode, setArcadeMode] = useState(false);
  const [rumble, setRumble] = useState(false);
  const [savageSkin, setSavageSkin] = useState(false);
  const [venue, setVenue] = useState<Venue>("arena");
  const [venueUnlocks, setVenueUnlocks] = useState<Record<UnlockableVenue, boolean>>(EMPTY_VENUE_UNLOCKS);
  const [achievementNotice, setAchievementNotice] = useState("");
  const [slowMoActive, setSlowMoActive] = useState(false);
  const [specialEndingIntro, setSpecialEndingIntro] = useState(false);
  const [showCodeEntry, setShowCodeEntry] = useState(false);
  const [secretCode, setSecretCode] = useState("");
  const [secretConfirmation, setSecretConfirmation] = useState("");
  const [finisherFrame, setFinisherFrame] = useState<
    "wobble" |
    "powerbomb-kick" | "powerbomb-head-pull" | "powerbomb-lift" | "powerbomb-impact" |
    "groin-kick" | "groin-recoil" | "groin-kneel" | "groin-knee" | "groin-down"
  >("wobble");
  const [finisherRunning, setFinisherRunning] = useState(false);
  const [mohawkFinisherFrame, setMohawkFinisherFrame] = useState<MohawkFinisherFrame>("fatality-01");
  const [showPonchCameo, setShowPonchCameo] = useState(false);

  const matchRef = useRef(matchState);
  const enemyHealthRef = useRef(enemyHealth);
  const playerHealthRef = useRef(playerHealth);
  const staminaRef = useRef(stamina);
  const guardRef = useRef(guard);
  const blockingRef = useRef(blocking);
  const dodgeRef = useRef<DodgeDirection>(dodgeDirection);
  const heldSlipRef = useRef<DodgeDirection>(null);
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
  const timerRef = useRef(timer);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const comboScoreBonusRef = useRef(0);
  const punchStatsRef = useRef<PunchStats>(EMPTY_PUNCH_STATS);
  const leaderboardRef = useRef<LeaderboardEntry[]>([]);
  const enemyAttackActionRef = useRef(0);
  const enemyQueueAttackRef = useRef<() => void>(() => undefined);
  const audioContextRef = useRef<AudioContext | null>(null);
  const preloadStartedRef = useRef(false);
  const flamingHandsRef = useRef(false);
  const ironJawRef = useRef(false);
  const endlessFightRef = useRef(false);
  const auraRef = useRef(false);
  const finisherEnabledRef = useRef(false);
  const brotalityEnabledRef = useRef(false);
  const slowMoRef = useRef(false);
  const arcadeModeRef = useRef(false);
  const rumbleRef = useRef(false);
  const savageSkinRef = useRef(false);
  const venueUnlocksRef = useRef<Record<UnlockableVenue, boolean>>(EMPTY_VENUE_UNLOCKS);
  const lastKnockdownPunchRef = useRef<PunchKind | null>(null);
  const slowMoTimerRef = useRef(0);
  const secretBufferRef = useRef("");
  const secretConfirmationTimerRef = useRef(0);
  const finisherRunningRef = useRef(false);
  const mohawkFinisherRunningRef = useRef(false);
  const ponchShownRef = useRef(false);

  useEffect(() => void (matchRef.current = matchState), [matchState]);
  useEffect(() => void (enemyHealthRef.current = enemyHealth), [enemyHealth]);
  useEffect(() => void (playerHealthRef.current = playerHealth), [playerHealth]);
  useEffect(() => void (staminaRef.current = stamina), [stamina]);
  useEffect(() => void (guardRef.current = guard), [guard]);
  useEffect(() => void (blockingRef.current = blocking), [blocking]);
  useEffect(() => void (dodgeRef.current = dodgeDirection), [dodgeDirection]);
  useEffect(() => void (poseRef.current = enemyPose), [enemyPose]);
  useEffect(() => void (specialRef.current = special), [special]);
  useEffect(() => void (timerRef.current = timer), [timer]);
  useEffect(() => void (comboRef.current = combo), [combo]);
  useEffect(() => void (flamingHandsRef.current = flamingHands), [flamingHands]);
  useEffect(() => void (ironJawRef.current = ironJaw), [ironJaw]);
  useEffect(() => void (endlessFightRef.current = endlessFight), [endlessFight]);
  useEffect(() => void (auraRef.current = aura), [aura]);
  useEffect(() => void (finisherEnabledRef.current = finisherEnabled), [finisherEnabled]);
  useEffect(() => void (brotalityEnabledRef.current = brotalityEnabled), [brotalityEnabled]);
  useEffect(() => void (slowMoRef.current = slowMo), [slowMo]);
  useEffect(() => void (arcadeModeRef.current = arcadeMode), [arcadeMode]);
  useEffect(() => void (rumbleRef.current = rumble), [rumble]);
  useEffect(() => {
    try {
      const storedUnlocks = JSON.parse(
        window.localStorage.getItem(VENUE_UNLOCKS_STORAGE_KEY) || "{}",
      ) as Partial<Record<UnlockableVenue, boolean>>;
      const nextUnlocks = {
        "tulip-street": storedUnlocks["tulip-street"] === true,
        "blue-bridge": storedUnlocks["blue-bridge"] === true,
        "madison-square-garden": storedUnlocks["madison-square-garden"] === true,
      };
      venueUnlocksRef.current = nextUnlocks;
      setVenueUnlocks(nextUnlocks);
    } catch {
      venueUnlocksRef.current = { ...EMPTY_VENUE_UNLOCKS };
    }
  }, []);

  const unlockVenue = useCallback((venueId: UnlockableVenue) => {
    if (venueUnlocksRef.current[venueId]) return false;
    const nextUnlocks = { ...venueUnlocksRef.current, [venueId]: true };
    venueUnlocksRef.current = nextUnlocks;
    setVenueUnlocks(nextUnlocks);
    try {
      window.localStorage.setItem(VENUE_UNLOCKS_STORAGE_KEY, JSON.stringify(nextUnlocks));
    } catch {
      // The venue remains unlocked for this session when storage is unavailable.
    }
    const unlockedVenue = VENUES.find(({ id }) => id === venueId);
    if (unlockedVenue?.background) warmAssets([asset(unlockedVenue.background)]);
    return true;
  }, []);

  const activateSecretCode = useCallback((rawCode: string) => {
    const code = rawCode.toUpperCase().replace(/[^A-Z0-9]/g, "");
    let confirmation = "";

    // Every player-favorable secret belongs in this registry. ZUPERMAN
    // activates the full registry, so future benefit codes only need to be
    // added here to become part of the master code automatically.
    const playerBenefitCodes = [
      {
        codes: ["FLAMEON"],
        confirmation: "FLAMING HANDS ACTIVATED",
        activate: () => {
          flamingHandsRef.current = true;
          setFlamingHands(true);
        },
      },
      {
        codes: ["IRONJAW"],
        confirmation: "IRON JAW ACTIVATED",
        activate: () => {
          ironJawRef.current = true;
          setIronJaw(true);
        },
      },
      {
        codes: ["TIMELESS", "ENDLESS"],
        confirmation: "TIMELESS FIGHT ACTIVATED",
        activate: () => {
          endlessFightRef.current = true;
          setEndlessFight(true);
        },
      },
      {
        codes: ["AURA"],
        confirmation: "AURA ACTIVATED",
        activate: () => {
          auraRef.current = true;
          setAura(true);
          guardRef.current = 100;
          setGuard(100);
        },
      },
      {
        codes: ["SLOWMO"],
        confirmation: "SLOW-MO COUNTERS ACTIVATED",
        activate: () => {
          slowMoRef.current = true;
          setSlowMo(true);
        },
      },
    ] as const;
    const matchedPlayerBenefit = playerBenefitCodes.find(({ codes }) =>
      codes.some((benefitCode) => code.endsWith(benefitCode))
    );

    if (code.endsWith("GRAND")) {
      unlockVenue("tulip-street");
      confirmation = "TULIP STREET UNLOCKED";
    } else if (code.endsWith("AZUL")) {
      unlockVenue("blue-bridge");
      confirmation = "BLUE BRIDGE UNLOCKED";
    } else if (code.endsWith("BIGTIME")) {
      unlockVenue("madison-square-garden");
      confirmation = "MADISON SQUARE GARDEN UNLOCKED";
    } else if (code.endsWith("ZUPERMAN")) {
      playerBenefitCodes.forEach(({ activate }) => activate());
      confirmation = "ZUPERMAN POWERS ACTIVATED";
    } else if (matchedPlayerBenefit) {
      matchedPlayerBenefit.activate();
      confirmation = matchedPlayerBenefit.confirmation;
    } else if (code.endsWith("FATALITY")) {
      finisherEnabledRef.current = true;
      setFinisherEnabled(true);
      warmAssets(FATALITY_ASSETS);
      warmAssets(PLAYER_FINISHER_ASSETS);
      confirmation = "FATALITY MODE ACTIVATED";
    } else if (code.endsWith("BROTALITY")) {
      brotalityEnabledRef.current = true;
      setBrotalityEnabled(true);
      warmAssets(BROTALITY_ASSETS);
      confirmation = "BROTALITY MODE ACTIVATED";
    } else if (code.endsWith("ARCADE")) {
      arcadeModeRef.current = true;
      setArcadeMode(true);
      confirmation = "ARCADE VISUALS ACTIVATED";
    } else if (code.endsWith("RUMBLE")) {
      rumbleRef.current = true;
      setRumble(true);
      confirmation = "RUMBLE IMPACTS ACTIVATED";
    } else if (code.endsWith("SAVAGE")) {
      savageSkinRef.current = true;
      setSavageSkin(true);
      warmAssets(SAVAGE_ASSETS);
      confirmation = "SAVAGE SKIN ACTIVATED";
    }
    if (!confirmation) return false;
    setSecretCode("");
    secretBufferRef.current = "";
    setSecretConfirmation(confirmation);
    window.clearTimeout(secretConfirmationTimerRef.current);
    secretConfirmationTimerRef.current = window.setTimeout(() => setSecretConfirmation(""), 2200);
    return true;
  }, [unlockVenue]);

  const deactivateSecretCode = useCallback((effect: SecretEffect) => {
    let label = "";
    if (effect === "flameon") {
      flamingHandsRef.current = false;
      setFlamingHands(false);
      label = "FLAMING HANDS";
    } else if (effect === "ironjaw") {
      ironJawRef.current = false;
      setIronJaw(false);
      label = "IRON JAW";
    } else if (effect === "timeless") {
      endlessFightRef.current = false;
      setEndlessFight(false);
      label = "TIMELESS";
    } else if (effect === "aura") {
      auraRef.current = false;
      setAura(false);
      label = "AURA";
    } else if (effect === "fatality") {
      finisherEnabledRef.current = false;
      setFinisherEnabled(false);
      label = "FATALITY";
    } else if (effect === "brotality") {
      brotalityEnabledRef.current = false;
      setBrotalityEnabled(false);
      label = "BROTALITY";
    } else if (effect === "slowmo") {
      slowMoRef.current = false;
      setSlowMo(false);
      setSlowMoActive(false);
      window.clearTimeout(slowMoTimerRef.current);
      label = "SLOWMO";
    } else if (effect === "arcade") {
      arcadeModeRef.current = false;
      setArcadeMode(false);
      label = "ARCADE";
    } else if (effect === "rumble") {
      rumbleRef.current = false;
      setRumble(false);
      label = "RUMBLE";
    } else {
      savageSkinRef.current = false;
      setSavageSkin(false);
      label = "SAVAGE SKIN";
    }
    setSecretConfirmation(`${label} DEACTIVATED`);
    window.clearTimeout(secretConfirmationTimerRef.current);
    secretConfirmationTimerRef.current = window.setTimeout(() => setSecretConfirmation(""), 1600);
  }, []);

  useEffect(() => {
    const readSecretCode = (event: KeyboardEvent) => {
      if (matchRef.current !== "intro" || event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "INPUT") return;
      if (!/^[a-z0-9]$/i.test(event.key)) return;
      secretBufferRef.current = `${secretBufferRef.current}${event.key.toUpperCase()}`.slice(-16);
      activateSecretCode(secretBufferRef.current);
    };
    window.addEventListener("keydown", readSecretCode);
    return () => window.removeEventListener("keydown", readSecretCode);
  }, [activateSecretCode]);

  useEffect(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(LEADERBOARD_STORAGE_KEY) || "[]") as LeaderboardEntry[];
      const valid = stored
        .filter((entry) => typeof entry?.initials === "string" && Number.isFinite(entry?.score))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      leaderboardRef.current = valid;
      setLeaderboard(valid);
    } catch {
      leaderboardRef.current = [];
      setLeaderboard([]);
    }
  }, []);

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
      while (nextAsset < CORE_POSE_ASSETS.length) {
        const src = CORE_POSE_ASSETS[nextAsset++];
        const image = new Image();
        image.decoding = "async";
        image.src = src;
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

  useEffect(() => {
    if (matchState !== "fighting" || !enemyPose.includes("-contact")) return;
    const strandedPose = enemyPose;
    const failsafe = window.setTimeout(() => {
      if (matchRef.current !== "fighting" || poseRef.current !== strandedPose) return;
      ++enemyAttackActionRef.current;
      setEnemyPoseSafe("idle");
      enemyQueueAttackRef.current();
    }, 700);
    return () => window.clearTimeout(failsafe);
  }, [enemyPose, matchState, setEnemyPoseSafe]);

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

  const triggerRumble = useCallback((heavy = false) => {
    if (!rumbleRef.current || typeof navigator === "undefined" || !navigator.vibrate) return;
    navigator.vibrate(heavy ? [45, 24, 90] : 28);
  }, []);

  const triggerSlowMo = useCallback((duration = 650) => {
    if (!slowMoRef.current) return;
    setSlowMoActive(true);
    window.clearTimeout(slowMoTimerRef.current);
    slowMoTimerRef.current = window.setTimeout(() => setSlowMoActive(false), duration);
  }, []);

  const finishMatch = useCallback((result: "won" | "lost", reason: ResultReason = "knockout") => {
    const resultActionId = ++playerActionRef.current;
    setSpecialEndingIntro(false);
    if (result === "won") {
      const finalScore = Math.max(
        0,
        calculatePunchScore(punchStatsRef.current)
          + comboScoreBonusRef.current
          + timerRef.current * TIME_BONUS_PER_SECOND
          - playerKnockdownsRef.current * PLAYER_KNOCKDOWN_SCORE_PENALTY,
      );
      scoreRef.current = finalScore;
      setScore(finalScore);
      const currentBoard = leaderboardRef.current;
      const codesWereActive = (
        flamingHandsRef.current
        || ironJawRef.current
        || endlessFightRef.current
        || auraRef.current
        || finisherEnabledRef.current
        || brotalityEnabledRef.current
        || slowMoRef.current
        || arcadeModeRef.current
        || rumbleRef.current
        || savageSkinRef.current
      );
      const leaderboardEligible = !codesWereActive;
      const qualifies = leaderboardEligible
        && (currentBoard.length < 10 || finalScore > currentBoard[currentBoard.length - 1].score);
      setAwaitingInitials(qualifies);
      setLeaderboardSubmitted(false);
      setInitials("");
      if (!codesWereActive) {
        const newlyUnlocked: string[] = [];
        if (unlockVenue("blue-bridge")) {
          newlyUnlocked.push("FIRST VICTORY · BLUE BRIDGE · CODE LEARNED: AZUL");
        }
        if (playerKnockdownsRef.current <= 3 && unlockVenue("tulip-street")) {
          newlyUnlocked.push("HOMETOWN TOUGH · TULIP STREET · CODE LEARNED: GRAND");
        }
        if (lastKnockdownPunchRef.current === "uppercut" && unlockVenue("madison-square-garden")) {
          newlyUnlocked.push("MAIN EVENT FINISH · MADISON SQUARE GARDEN · CODE LEARNED: BIGTIME");
        }
        setAchievementNotice(newlyUnlocked.join("  •  "));
      } else {
        setAchievementNotice("");
      }
    } else {
      setAwaitingInitials(false);
      setLeaderboardSubmitted(false);
      setAchievementNotice("");
    }
    setResultReason(reason);
    matchRef.current = result;
    setMatchState(result);
    setShowRematch(false);
    setBlocking(false);
    blockingRef.current = false;
    dodgeRef.current = null;
    heldSlipRef.current = null;
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
  }, [playSound, setEnemyPoseSafe, unlockVenue]);

  const executeFinisher = useCallback(() => {
    if (matchRef.current !== "finisher" || finisherRunningRef.current) return;
    finisherRunningRef.current = true;
    setFinisherRunning(true);
    setCallout("FINISHER!");
    setFinisherFrame("powerbomb-kick");
    setCallout("POWERBOMB!");
    setImpact("body");
    setScreenShake(true);
    playSound("punch");
    window.setTimeout(() => {
      setImpact(null);
      setScreenShake(false);
      setFinisherFrame("powerbomb-head-pull");
      setCallout("SET HIM UP!");
    }, 430);
    window.setTimeout(() => {
      setFinisherFrame("powerbomb-lift");
      setCallout("LIFT!");
    }, 920);
    window.setTimeout(() => {
      setFinisherFrame("powerbomb-impact");
      setImpact("right");
      setScreenShake(true);
      playSound("ko");
    }, 1780);
    window.setTimeout(() => {
      setImpact(null);
      setScreenShake(false);
      finisherRunningRef.current = false;
      setFinisherRunning(false);
      finishMatch("won");
    }, 2920);
  }, [finishMatch, playSound]);

  const executeGroinFinisher = useCallback(() => {
    if (matchRef.current !== "finisher" || finisherRunningRef.current) return;
    finisherRunningRef.current = true;
    setFinisherRunning(true);
    setCallout("LOW BLOW!");
    setFinisherFrame("groin-kick");
    setImpact("right");
    setScreenShake(true);
    playSound("hurt");
    window.setTimeout(() => {
      setImpact(null);
      setScreenShake(false);
      setFinisherFrame("groin-recoil");
      setCallout("THAT HURT!");
    }, 520);
    window.setTimeout(() => {
      setFinisherFrame("groin-kneel");
      setCallout("RUNNING KNEE!");
    }, 1050);
    window.setTimeout(() => {
      setFinisherFrame("groin-knee");
      setImpact("right");
      setScreenShake(true);
      playSound("ko");
    }, 1580);
    window.setTimeout(() => {
      setImpact(null);
      setScreenShake(false);
      setFinisherFrame("groin-down");
      setCallout("MOHAWK IS DOWN!");
    }, 2250);
    window.setTimeout(() => {
      setImpact(null);
      setScreenShake(false);
      finisherRunningRef.current = false;
      setFinisherRunning(false);
      finishMatch("won");
    }, 3200);
  }, [finishMatch, playSound]);

  const startMohawkFinisher = useCallback((reason: ResultReason = "knockout") => {
    if (mohawkFinisherRunningRef.current || matchRef.current === "mohawk-finisher") return;
    const fatalityActive = finisherEnabledRef.current;
    const brotalityActive = brotalityEnabledRef.current;
    if (!fatalityActive && !brotalityActive) {
      finishMatch("lost", reason);
      return;
    }
    mohawkFinisherRunningRef.current = true;
    ++playerActionRef.current;
    matchRef.current = "mohawk-finisher";
    setMatchState("mohawk-finisher");
    setResultReason(reason);
    setBlocking(false);
    blockingRef.current = false;
    const category = fatalityActive && brotalityActive
      ? (Math.random() < .5 ? "fatality" : "brotality")
      : fatalityActive ? "fatality" : "brotality";
    const brotalityKind = category === "brotality"
      ? (Math.random() < .5 ? "chair" : "headbutt")
      : null;
    const chairFinisher = brotalityKind === "chair";
    const headbuttFinisher = brotalityKind === "headbutt";
    setMohawkFinisherFrame(chairFinisher ? "chair-slide" : headbuttFinisher ? "brotality-enter" : "fatality-01");
    setPlayerPose("hit");
    setEnemyPoseSafe("idle");
    setSpecialEndingIntro(true);
    setCallout("THE LIGHTS GO DOWN...");
    playSound(reason === "time" ? "bell" : "hurt");
    const revealDelay = 1650;
    const scheduleFinisher = (delay: number, callback: () => void) =>
      window.setTimeout(callback, revealDelay + delay);
    window.setTimeout(() => {
      if (matchRef.current !== "mohawk-finisher") return;
      setSpecialEndingIntro(false);
      setCallout(category === "fatality" ? "MOHAWK WINS!" : "WAIT—SOMEBODY'S IN THE RING!");
    }, revealDelay);

    if (chairFinisher) {
      scheduleFinisher(650, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setMohawkFinisherFrame("chair-charge");
        setCallout("WATCH THE CHAIR!");
      });
      scheduleFinisher(1350, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setMohawkFinisherFrame("chair-impact");
        setCallout("STEEL CHAIR!");
        setImpact("player");
        setScreenShake(true);
        triggerRumble(true);
        playSound("ko");
      });
      scheduleFinisher(2050, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setImpact(null);
        setScreenShake(false);
        setMohawkFinisherFrame("chair-aftermath");
        setCallout("MOHAWK WINS!");
      });
      scheduleFinisher(3300, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        mohawkFinisherRunningRef.current = false;
        finishMatch("lost", reason);
      });
      return;
    }
    if (headbuttFinisher) {
      scheduleFinisher(600, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setMohawkFinisherFrame("brotality-run");
        setCallout("JOVAN'S CHARGING!");
      });
      scheduleFinisher(1150, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setMohawkFinisherFrame("brotality-windup");
        setCallout("LOOK OUT!");
      });
      scheduleFinisher(1700, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setMohawkFinisherFrame("brotality-impact");
        setCallout("BROTALITY!");
        setImpact("player");
        setScreenShake(true);
        triggerRumble(true);
        playSound("ko");
      });
      scheduleFinisher(2350, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setImpact(null);
        setScreenShake(false);
        setMohawkFinisherFrame("brotality-victory");
        setCallout("MOHAWK WINS!");
      });
      scheduleFinisher(3650, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        mohawkFinisherRunningRef.current = false;
        finishMatch("lost", reason);
      });
      return;
    }

    const dragonSequence: Array<{ frame: DragonFatalityFrame; at: number; callout?: string }> = [
      { frame: "fatality-02", at: 600 },
      { frame: "fatality-03", at: 1250, callout: "THE DRAGON AWAKENS!" },
      { frame: "fatality-04", at: 2150, callout: "FACE THE DRAGON!" },
      { frame: "fatality-05", at: 2950 },
      { frame: "fatality-06", at: 3500, callout: "FATALITY!" },
      { frame: "fatality-07", at: 4050 },
    ];
    dragonSequence.forEach(({ frame, at, callout }) => {
      scheduleFinisher(at, () => {
        if (matchRef.current !== "mohawk-finisher") return;
        setMohawkFinisherFrame(frame);
        if (callout) setCallout(callout);
        if (frame === "fatality-07") {
          setImpact("player");
          setScreenShake(true);
          triggerRumble(true);
          playSound("ko");
        }
      });
    });
    scheduleFinisher(5250, () => {
      if (matchRef.current !== "mohawk-finisher") return;
      setImpact(null);
      setScreenShake(false);
      mohawkFinisherRunningRef.current = false;
      finishMatch("lost", reason);
    });
  }, [finishMatch, playSound, setEnemyPoseSafe, triggerRumble]);

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
    setPaused(false);
    ++enemyAttackActionRef.current;
    setEnemyPoseSafe("idle");
    setPlayerPose("idle");
    setDodgeDirection(null);
    dodgeRef.current = null;
    setBlocking(false);
    blockingRef.current = false;
    setCombo(0);
    comboRef.current = 0;
    setScore(0);
    scoreRef.current = 0;
    comboScoreBonusRef.current = 0;
    setComboScoreBonus(0);
    punchStatsRef.current = { ...EMPTY_PUNCH_STATS };
    setPunchStats({ ...EMPTY_PUNCH_STATS });
    setInitials("");
    setAwaitingInitials(false);
    setLeaderboardSubmitted(false);
    setShowLeaderboard(false);
    setAchievementNotice("");
    setImpact(null);
    setHitStop(false);
    setSecondWind(false);
    enemyKnockdownsRef.current = 0;
    lastKnockdownPunchRef.current = null;
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
    finisherRunningRef.current = false;
    mohawkFinisherRunningRef.current = false;
    setFinisherRunning(false);
    setFinisherFrame("wobble");
    setMohawkFinisherFrame("fatality-01");
    setSpecialEndingIntro(false);
    setShowPonchCameo(false);
    ponchShownRef.current = false;
    bufferedPunchRef.current = null;
    guardBrokenUntilRef.current = 0;
    setFightCountdown(3);
    setCallout("GET READY");
    matchRef.current = "countdown";
    setMatchState("countdown");
    setAudioReady(true);
  }, [assetsReady, setEnemyPoseSafe]);

  useEffect(() => {
    if (matchState !== "countdown") return;
    const two = window.setTimeout(() => setFightCountdown(2), 700);
    const one = window.setTimeout(() => setFightCountdown(1), 1400);
    const fight = window.setTimeout(() => {
      if (matchRef.current !== "countdown") return;
      matchRef.current = "fighting";
      setMatchState("fighting");
      setCallout("FIGHT!");
      playSound("bell");
      window.setTimeout(() => {
        if (matchRef.current === "fighting") setCallout("READ THE SHOULDERS");
      }, 900);
    }, 2100);
    return () => {
      window.clearTimeout(two);
      window.clearTimeout(one);
      window.clearTimeout(fight);
    };
  }, [matchState, playSound]);

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
    heldSlipRef.current = null;
    setDodgeDirection(null);
    setPlayerPose("idle");
    setEnemyPoseSafe("idle");
    setSecondWind(false);
    setImpact(null);
    setHitStop(false);
    setScreenShake(false);
    setSlowMoActive(false);
    setSpecialEndingIntro(false);
    window.clearTimeout(slowMoTimerRef.current);
    setCallout("");
    setShowLeaderboard(false);
  }, [setEnemyPoseSafe]);

  const submitLocalScore = useCallback(() => {
    const cleanInitials = initials.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    const codesActive = flamingHandsRef.current
      || ironJawRef.current
      || endlessFightRef.current
      || auraRef.current
      || finisherEnabledRef.current
      || brotalityEnabledRef.current
      || slowMoRef.current
      || arcadeModeRef.current
      || rumbleRef.current
      || savageSkinRef.current;
    if (codesActive || matchRef.current !== "won" || !awaitingInitials || cleanInitials.length !== 3) return;
    const entry: LeaderboardEntry = {
      initials: cleanInitials,
      score: scoreRef.current,
      date: new Date().toISOString(),
      version: GAME_VERSION,
    };
    const nextBoard = [...leaderboardRef.current, entry]
      .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))
      .slice(0, 10);
    leaderboardRef.current = nextBoard;
    setLeaderboard(nextBoard);
    try {
      window.localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(nextBoard));
    } catch {
      // The current result remains visible even if private browsing blocks
      // persistent storage.
    }
    setInitials(cleanInitials);
    setAwaitingInitials(false);
    setLeaderboardSubmitted(true);
    setShowLeaderboard(true);
  }, [awaitingInitials, initials]);

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

  const takePlayerDamage = useCallback((amount: number, preserveGuardPose = false) => {
    if (auraRef.current) {
      setCallout("AURA BLOCK!");
      setImpact("player");
      playSound("dodge");
      window.setTimeout(() => setImpact(null), 150);
      return;
    }
    const appliedAmount = ironJawRef.current ? amount / 3 : amount;
    const next = clamp(playerHealthRef.current - appliedAmount);
    const guardAbsorbedHit = preserveGuardPose && blockingRef.current && next > 0;
    const actionId = guardAbsorbedHit ? playerActionRef.current : ++playerActionRef.current;
    playerHealthRef.current = next;
    setPlayerHealth(next);
    setCombo(0);
    comboRef.current = 0;
    setImpact("player");
    setScreenShake(true);
    triggerRumble(appliedAmount >= 18);
    if (!guardAbsorbedHit) setPlayerPose("hit");
    playSound("hurt");
    window.setTimeout(() => setImpact(null), 170);
    window.setTimeout(() => setScreenShake(false), 240);
    if (!guardAbsorbedHit) {
      window.setTimeout(() => {
        if (matchRef.current === "fighting" && playerActionRef.current === actionId) setPlayerPose("idle");
      }, 260);
    }
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
      // Going down must matter even if the player gets back up and wins.
      // Apply the penalty immediately so the live score and final result
      // always agree.
      const penalizedScore = Math.max(
        0,
        calculatePunchScore(punchStatsRef.current)
          + comboScoreBonusRef.current
          - knockdowns * PLAYER_KNOCKDOWN_SCORE_PENALTY,
      );
      scoreRef.current = penalizedScore;
      setScore(penalizedScore);
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
  }, [playSound, setEnemyPoseSafe, triggerRumble]);

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
          if (matchRef.current === "player-down") startMohawkFinisher("knockout");
        }, 650);
      }
    }, 800);
    return () => {
      window.clearInterval(countTimer);
      if (countOutTimer) window.clearTimeout(countOutTimer);
    };
  }, [matchState, startMohawkFinisher]);

  useEffect(() => {
    if (matchState !== "enemy-down") return;
    let count = 1;
    let resolutionTimer: number | undefined;
    const attemptTimers: number[] = [];
    const ponchAppears = !ponchShownRef.current && Math.random() < .35;
    if (ponchAppears) ponchShownRef.current = true;
    setShowPonchCameo(ponchAppears);
    const riseAtForSequence = enemyRiseAtRef.current;
    const targetAttempts = 2 + Math.floor(Math.random() * 3);
    const failedAttemptsNeeded = targetAttempts - (riseAtForSequence === null ? 0 : 1);
    const availableCounts = riseAtForSequence === null
      ? [2, 4, 6, 8, 9]
      : Array.from({ length: Math.max(0, riseAtForSequence - 2) }, (_, index) => index + 2);
    const failedAttemptCounts = new Set(
      availableCounts
        .sort(() => Math.random() - .5)
        .slice(0, Math.max(0, failedAttemptsNeeded - 1)),
    );
    // Every knee sequence begins with a visible effort to rise. A successful
    // stand counts as the final attempt; a ten-count receives 2–4 failed tries.
    if (failedAttemptsNeeded > 0) {
      attemptTimers.push(window.setTimeout(() => {
        if (matchRef.current !== "enemy-down") return;
        setEnemyPoseSafe("failed-rise");
        setCallout("MOHAWK BRACES ON HIS KNEE!");
        attemptTimers.push(window.setTimeout(() => {
          if (matchRef.current === "enemy-down" && poseRef.current === "failed-rise") {
            setEnemyPoseSafe("knockdown-knee");
            setCallout("HE CANNOT RISE YET!");
          }
        }, 430));
      }, 130));
    }
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
        if (failedAttemptCounts.has(count)) {
          const attemptCountValue = count;
          setEnemyPoseSafe("failed-rise");
          setCallout(attemptCountValue >= 8 ? "MOHAWK WILLS HIMSELF UP!" : "MOHAWK TRIES TO STAND!");
          attemptTimers.push(window.setTimeout(() => {
            if (matchRef.current === "enemy-down" && poseRef.current === "failed-rise") {
              setEnemyPoseSafe("knockdown-knee");
              setCallout(attemptCountValue >= 8 ? "HE FALLS BACK TO THE KNEE!" : "NOT YET!");
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
  }, [finishMatch, matchState, playSound, setEnemyPoseSafe]);

  useEffect(() => {
    if (!showPonchCameo) return;
    const timer = window.setTimeout(() => setShowPonchCameo(false), 3800);
    return () => window.clearTimeout(timer);
  }, [showPonchCameo]);

  useEffect(() => {
    if (matchState !== "fighting") return;
    const ticker = window.setInterval(() => {
      if (endlessFightRef.current) return;
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
      if (auraRef.current) {
        guardRef.current = 100;
        setGuard(100);
      } else if (!blockingRef.current) {
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
    type AttackStyle = "normal" | "heavy" | "haymaker" | "flurry" | "uppercut" | "power-combo";
    let cancelled = false;
    const timers: number[] = [];
    const later = (fn: () => void, delay: number) => {
      const id = window.setTimeout(() => !cancelled && fn(), delay);
      timers.push(id);
    };

    const queueAttack = () => {
      if (cancelled || matchRef.current !== "fighting") return;
      const rage = enemyHealthRef.current <= 35;
      const fightPhase = Math.min(enemyKnockdownsRef.current, 3);
      const delay = fightPhase === 0
        ? 170 + Math.random() * 180
        : fightPhase === 1
          ? 430 + Math.random() * 300
          : fightPhase === 2
            ? 250 + Math.random() * 220
            : rage
              ? 180 + Math.random() * 200
              : 320 + Math.random() * 280;
      later(beginAttack, delay);
    };
    enemyQueueAttackRef.current = queueAttack;

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

    const throwStrike = (
      combination: EnemyMove[],
      index: number,
      style: AttackStyle = "normal",
      sequenceId = ++enemyAttackActionRef.current,
    ) => {
      if (cancelled || matchRef.current !== "fighting") return;
      if (sequenceId !== enemyAttackActionRef.current) return;
      const move = combination[index];
      const rage = enemyHealthRef.current <= 35;
      const firstPunch = index === 0;
      const comboUppercut = style === "power-combo" && move === "uppercut";
      const comboHaymaker = style === "power-combo" && !comboUppercut;
      const directionalHaymaker = style === "haymaker";
      const powerShot = style === "heavy" || directionalHaymaker;
      const windup = powerShot ? 520
        : comboUppercut ? 250
        : comboHaymaker ? firstPunch ? 430 : 115
        : style === "uppercut" ? 480
        : style === "flurry" ? firstPunch ? 185 : 58
        : firstPunch ? rage ? 240 : move === "body" ? 430 : 340
        : rage ? 90 : move === "body" ? 180 : 130;
      const windupPose: FighterPose = directionalHaymaker ? move === "left" ? "windup-haymaker-left" : "windup-haymaker-right"
        : style === "heavy" ? "windup-heavy"
        : comboUppercut ? "windup-uppercut"
        : comboHaymaker ? `windup-combo-${move}` as FighterPose
        : style === "uppercut" ? "windup-uppercut"
        : `windup-${move}` as FighterPose;
      const attackPose: FighterPose = directionalHaymaker ? move === "left" ? "attack-haymaker-left" : "attack-haymaker-right"
        : style === "heavy" ? "attack-heavy"
        : comboUppercut ? "attack-uppercut"
        : comboHaymaker ? `attack-combo-${move}` as FighterPose
        : style === "uppercut" ? "attack-uppercut"
        : `attack-${move}` as FighterPose;
      const contactPose: FighterPose = directionalHaymaker ? move === "left" ? "attack-haymaker-left-contact" : "attack-haymaker-right-contact"
        : style === "heavy" ? "attack-heavy-contact"
        : move === "left" ? "attack-left-contact"
        : move === "right" ? "attack-right-contact"
        : move === "body" ? "attack-body-contact"
        : "attack-uppercut-contact";
      const resolutionDelay = style === "heavy" ? 16
        : directionalHaymaker ? 320
        : comboUppercut ? 280
        : comboHaymaker ? 175
        : style === "uppercut" ? 280
        : style === "flurry" ? 92
        : rage ? 125
        : 155;
      const contactLead = style === "flurry" ? 30 : powerShot ? 80 : 55;
      setEnemyPoseSafe(windupPose);
      setCallout(directionalHaymaker ? `${move.toUpperCase()} HAYMAKER — SLIP ${move === "right" ? "LEFT" : "RIGHT"}!` : style === "heavy" ? "OVERHAND — HE RETREATS!" : style === "power-combo" ? comboUppercut ? "COMBO FINISHER!" : "HAYMAKER BARRAGE!" : style === "flurry" ? "VOLUME FLURRY" : style === "uppercut" ? "WATCH THE CENTER" : "PRESSURE");

      later(() => {
        if (matchRef.current !== "fighting" || sequenceId !== enemyAttackActionRef.current) return;
        // The overhand is deliberately a two-frame attack: the retreating
        // cock-back, followed directly by the fist-at-camera impact frame.
        const visibleAttackPose = style === "heavy" ? contactPose : attackPose;
        setEnemyPoseSafe(visibleAttackPose);
        // Every punch gets a dedicated foreshortened contact frame. Do not
        // show it when the player has already completed the correct slip.
        if (style !== "heavy") {
          later(() => {
            if (matchRef.current !== "fighting" || sequenceId !== enemyAttackActionRef.current || poseRef.current !== attackPose) return;
            const alreadyDodging = dodgeRef.current !== null &&
              (directionalHaymaker
                ? (move === "right" && dodgeRef.current === "left") || (move === "left" && dodgeRef.current === "right")
                : move === "body" || move === "uppercut" ||
                  (move === "left" && dodgeRef.current === "right") ||
                  (move === "right" && dodgeRef.current === "left"));
            if (!alreadyDodging) setEnemyPoseSafe(contactPose);
          }, Math.max(35, resolutionDelay - contactLead));
        }
        // Let the committed punch frame render before resolving contact.
        // This keeps the visual impact and damage event in the same sequence.
        later(() => {
          if (matchRef.current !== "fighting" || sequenceId !== enemyAttackActionRef.current) return;
          // A strike may only resolve while its matching punch frame is still
          // on screen. If the player interrupted Esteban during this window,
          // cancel the contact instead of applying invisible damage.
          if (poseRef.current !== visibleAttackPose && poseRef.current !== contactPose) {
            queueAttack();
            return;
          }
          const dodged = dodgeRef.current !== null &&
            (directionalHaymaker
              ? (move === "right" && dodgeRef.current === "left") || (move === "left" && dodgeRef.current === "right")
              : style === "heavy" || move === "body" || move === "uppercut" ||
                (move === "left" && dodgeRef.current === "right") ||
                (move === "right" && dodgeRef.current === "left"));

          if (dodged) {
            const slowMoBonus = slowMoRef.current ? 1000 : 0;
            counterReadyUntilRef.current = performance.now() + (powerShot ? 980 : 720) + slowMoBonus;
            triggerSlowMo(powerShot ? 1400 : 1100);
            setCallout(directionalHaymaker ? `${move === "right" ? "LEFT" : "RIGHT"} SLIP — HAYMAKER PUNISH!` : style === "heavy" ? "OVERHAND MISSED — PUNISH HIM!" : "PERFECT SLIP — COUNTER!");
            // A slip is not a hit. Mohawk completes the missed punch and
            // recovers his stance without playing a damage reaction.
            setEnemyPoseSafe("returning");
            playSound("dodge");
            later(() => {
              if (matchRef.current === "fighting" && poseRef.current === "returning") {
                setEnemyPoseSafe("idle");
                setCallout(enemyHealthRef.current <= 35 ? "MOHAWK IS RAGING" : "STAY SHARP");
              }
              queueAttack();
            }, (powerShot ? 850 : rage ? 340 : 480) + slowMoBonus);
            return;
          }

          if (blockingRef.current && guardRef.current > 0) {
            const lateBlock = performance.now() - blockStartedAtRef.current < 95;
            const baseGuardCost = powerShot ? 42 : comboUppercut ? 30 : comboHaymaker ? 18 : style === "uppercut" ? 34 : style === "flurry" ? 14 : move === "body" ? 30 : 22;
            const guardCost = baseGuardCost + (lateBlock ? 9 : 0);
            const canBreakGuard = powerShot || comboUppercut || comboHaymaker || style === "uppercut";
            // Ordinary jabs, crosses, and flurry punches can pressure a guard,
            // but only a designated power shot can actually break through it.
            const nextGuard = auraRef.current
              ? 100
              : canBreakGuard
                ? clamp(guardRef.current - guardCost)
                : Math.max(1, clamp(guardRef.current - guardCost));
            guardRef.current = nextGuard;
            setGuard(nextGuard);
            const chip = powerShot ? 5 : comboUppercut ? 4 : comboHaymaker ? 2 : style === "uppercut" ? 4 : style === "flurry" ? .5 : move === "body" ? 3 : .5;
            takePlayerDamage(lateBlock ? chip + 4 : chip, nextGuard > 0);
            setCallout(auraRef.current ? "AURA BLOCK!" : nextGuard <= 0 ? "GUARD BROKEN!" : directionalHaymaker ? "HAYMAKER CRUSHES YOUR GUARD!" : style === "heavy" ? "OVERHAND CRUSHES YOUR GUARD!" : lateBlock ? "LATE BLOCK" : "BLOCKED");
            if (nextGuard <= 0) {
              setBlocking(false);
              blockingRef.current = false;
              guardBrokenUntilRef.current = performance.now() + 700;
            }
          } else {
            const damage = powerShot ? 25 : comboUppercut ? 16 : comboHaymaker ? 10 : style === "uppercut" ? 14 : style === "flurry" ? 4 : move === "body" ? 11 : rage ? 11 : 9;
            takePlayerDamage(damage);
            setCallout(directionalHaymaker ? `MOHAWK ${move.toUpperCase()} HAYMAKER!` : style === "heavy" ? "MOHAWK OVERHAND!" : style === "uppercut" ? "UPPERCUT!" : move === "body" ? "LIVER SHOT!" : "CLEAN HIT");
          }

          if (index + 1 < combination.length) {
            later(() => throwStrike(combination, index + 1, style, sequenceId), style === "flurry" ? 34 : style === "power-combo" ? 75 : rage ? 55 : 85);
          } else {
            later(() => {
              if (matchRef.current === "fighting") {
                setEnemyPoseSafe("idle");
                queueAttack();
              }
            }, rage ? 230 : 360);
          }
        }, resolutionDelay);
      }, windup);
    };

    const beginAttack = () => {
      if (cancelled || matchRef.current !== "fighting") return;
      if (poseRef.current.startsWith("hit")) {
        queueAttack();
        return;
      }
      const fightPhase = Math.min(enemyKnockdownsRef.current, 3);
      const pattern = Math.random();
      if (fightPhase === 0) {
        // Opening phase: Mohawk wins exchanges with relentless hand speed and
        // volume, but flurries remain a signature surprise instead of every
        // other exchange.
        if (pattern < .22) throwStrike(["left", "right", "left", "right", "left"], 0, "flurry");
        else if (pattern < .36) throwStrike(["right", "left", "right", "left"], 0, "flurry");
        else if (pattern < .66) throwStrike(["left", "right", "left"], 0);
        else if (pattern < .82) throwStrike(chooseCombination(), 0);
        else if (pattern < .94) throwStrike(["uppercut"], 0, "uppercut");
        else throwStrike(["right"], 0, "heavy");
      } else if (fightPhase === 1) {
        // After the first knee he becomes measured: cover up, read the player,
        // then answer with shorter, safer combinations.
        if (pattern < .3) {
          setEnemyPoseSafe("guard");
          setCallout("MOHAWK TIGHTENS HIS DEFENSE");
          later(() => {
            if (matchRef.current !== "fighting") return;
            // A player punch can replace the guard pose before this timer
            // expires. The old pose-gated callback then never queued another
            // attack, stranding Mohawk in a permanent idle loop.
            if (poseRef.current === "guard") setEnemyPoseSafe("idle");
            // Defense in this phase always leads to a deliberate counter;
            // never roll immediately into another passive guard cycle.
            later(() => throwStrike(Math.random() < .5 ? ["left", "right"] : ["body", "right"], 0), 120);
          }, 500 + Math.random() * 300);
        } else if (pattern < .52) throwStrike(["left", "right"], 0);
        else if (pattern < .7) throwStrike(["body", "right"], 0);
        else if (pattern < .84) throwStrike(["right"], 0, "heavy");
        else throwStrike(chooseCombination(), 0);
      } else if (fightPhase === 2) {
        // After the second knee, abandon caution and hunt with power.
        if (pattern < .25) throwStrike(["right"], 0, "haymaker");
        else if (pattern < .5) throwStrike(["left"], 0, "haymaker");
        else if (pattern < .76) throwStrike(["uppercut"], 0, "uppercut");
        else if (pattern < .92) throwStrike(["right", "left", "right", "left", "uppercut"], 0, "power-combo");
        else throwStrike(["right"], 0, "heavy");
      } else {
        // Fourth phase: no readable identity—every established pattern is live.
        if (pattern < .13) throwStrike(["right", "left", "right", "left", "uppercut"], 0, "power-combo");
        else if (pattern < .19) throwStrike(["right"], 0, "heavy");
        else if (pattern < .235) throwStrike(["right"], 0, "haymaker");
        else if (pattern < .28) throwStrike(["left"], 0, "haymaker");
        else if (pattern < .44) throwStrike(["left", "right", "left", "right", "left"], 0, "flurry");
        else if (pattern < .58) throwStrike(["uppercut"], 0, "uppercut");
        else throwStrike(chooseCombination(), 0);
      }
    };

    later(queueAttack, 750);
    return () => {
      cancelled = true;
      enemyQueueAttackRef.current = () => undefined;
      timers.forEach(window.clearTimeout);
    };
  }, [matchState, playSound, setEnemyPoseSafe, takePlayerDamage, triggerSlowMo]);

  const punch = useCallback((requestedKind: PunchKind): void => {
    if (matchRef.current !== "fighting" || blockingRef.current) return;
    const kind: PunchKind =
      requestedKind === "right" && heldSlipRef.current === "right" ? "right-haymaker"
        : requestedKind === "left" && heldSlipRef.current === "left" ? "left-haymaker"
          : requestedKind;
    const isHaymaker = kind === "haymaker" || kind === "left-haymaker" || kind === "right-haymaker";
    if (kind === "uppercut" && specialRef.current < 100) {
      setCallout("BUILD YOUR SPECIAL!");
      return;
    }
    if (punchLockRef.current) {
      if (kind === "left" || kind === "right" || kind === "body") bufferedPunchRef.current = kind;
      return;
    }
    const cost = kind === "left" ? 6 : kind === "left-uppercut" ? 10 : kind === "power-jab" ? 12 : kind === "right" ? 9 : kind === "right-hook" ? 12 : kind === "body" ? 11 : kind === "uppercut" ? 18 : isHaymaker ? 19 : 19;
    if (!flamingHandsRef.current && staminaRef.current < cost) {
      setCallout("BREATHE — LOW STAMINA");
      return;
    }

    punchLockRef.current = true;
    const actionId = ++playerActionRef.current;
    const nextStamina = flamingHandsRef.current ? 100 : clamp(staminaRef.current - cost);
    staminaRef.current = nextStamina;
    setStamina(nextStamina);
    if (kind === "uppercut") {
      specialRef.current = 0;
      setSpecial(0);
    }
    setPlayerPose(kind === "left" ? "jab-left" : kind === "left-uppercut" ? "left-uppercut" : kind === "power-jab" ? "power-jab" : kind === "right" ? "cross-right" : kind === "right-hook" ? "right-hook" : kind === "left-haymaker" ? "left-haymaker" : kind === "right-haymaker" ? "right-haymaker" : kind === "body" ? "body-hook" : kind === "uppercut" ? "special-uppercut" : "haymaker");

    // Mohawk reads obvious offense and actively closes his guard.
    const canReadPunch = poseRef.current === "idle" || poseRef.current === "taunt";
    const fightPhase = Math.min(enemyKnockdownsRef.current, 3);
    const phaseGuardBonus = fightPhase === 1 ? .24 : fightPhase === 0 ? -.04 : 0;
    const guardChance = clamp((isHaymaker || kind === "uppercut" ? .4 : kind === "power-jab" ? .22 : .12) + phaseGuardBonus, 0, .72);
    if (canReadPunch && Math.random() < guardChance) {
      setEnemyPoseSafe("guard");
    }

    // Resolve damage on the extension/contact frame, never on button-down.
    window.setTimeout(() => {
      if (matchRef.current !== "fighting" || playerActionRef.current !== actionId || blockingRef.current) return;
      // Mohawk physically retreats during his haymaker load. The player may
      // swing, but cannot damage or interrupt him until he lunges back in.
      if (poseRef.current === "windup-heavy") {
        setCombo(0);
        comboRef.current = 0;
        setCallout("OUT OF RANGE!");
        playSound("dodge");
        return;
      }
      const enemyIsOpen = poseRef.current === "stumble-back" || poseRef.current.startsWith("windup");
      const enemyIsGuarding = poseRef.current === "guard" && !flamingHandsRef.current;
      const slipCounter = performance.now() <= counterReadyUntilRef.current;
      const base = kind === "left" ? 4 : kind === "left-uppercut" ? 10 : kind === "power-jab" ? 12 : kind === "right" ? 7 : kind === "right-hook" ? 12 : kind === "body" ? 6 : kind === "uppercut" ? 72 : isHaymaker ? 43 : 43;
      const fullDamage = enemyIsGuarding ? 0 : slipCounter ? Math.round(base * 3.6) : enemyIsOpen ? Math.round(base * (isHaymaker ? 1.25 : 2.1)) : base;
      const nextCombo = enemyIsGuarding ? 0 : comboRef.current + 1;
      const comboDamageMultiplier = nextCombo < 3
        ? 1
        : Math.min(1.25, 1.05 + (nextCombo - 3) * .025);
      // Normal punches should accumulate pressure rather than drop an
      // iron-jawed champion like an ordinary opponent. Counters and charged
      // power retain their multipliers, but all incoming damage is scaled.
      const damage = (fullDamage / 7) * comboDamageMultiplier;
      // TIMELESS controls only the clock. It must not alter Mohawk's health,
      // knee behavior, or eligibility for a finishing sequence.
      const nextHealth = clamp(enemyHealthRef.current - damage);

      if (slipCounter) {
        counterReadyUntilRef.current = 0;
        triggerSlowMo(430);
      }

      enemyHealthRef.current = nextHealth;
      setEnemyHealth(nextHealth);
      // Any clean player hit owns the next opponent pose. Invalidate every
      // pending windup/contact callback from the interrupted enemy attack so
      // it cannot restore an extended fist over the current hit reaction.
      if (!enemyIsGuarding) {
        ++enemyAttackActionRef.current;
        window.setTimeout(() => enemyQueueAttackRef.current(), 0);
      }
      comboRef.current = nextCombo;
      setCombo(nextCombo);
      const stumbleChance = kind === "uppercut"
        ? 1
        : slipCounter
          ? .72
          : isHaymaker
            ? .62
            : kind === "power-jab" || kind === "right-hook" || kind === "left-uppercut"
              ? .28
              : 0;
      const lowHealthStumbleBonus = nextHealth <= 15 ? .16 : nextHealth <= 35 ? .08 : 0;
      const triggersStumble = !enemyIsGuarding
        && nextHealth > 0
        && Math.random() < Math.min(1, stumbleChance + lowHealthStumbleBonus);
      if (!enemyIsGuarding) {
        if (kind === "uppercut") {
          staminaRef.current = 100;
          guardRef.current = 100;
          setStamina(100);
          setGuard(100);
        }
        const specialGain = kind === "left" ? 3 : kind === "left-uppercut" ? 4 : kind === "power-jab" ? 6 : kind === "right" ? 4 : kind === "right-hook" ? 5 : kind === "body" ? 5 : isHaymaker ? 7 : 0;
        const nextSpecial = clamp(specialRef.current + specialGain + (slipCounter ? 4 : 0));
        specialRef.current = nextSpecial;
        setSpecial(nextSpecial);
        const statKey = statKeyForPunch(kind);
        const nextStats = { ...punchStatsRef.current, [statKey]: punchStatsRef.current[statKey] + 1 };
        punchStatsRef.current = nextStats;
        setPunchStats(nextStats);
        const comboScoreMultiplier = nextCombo < 3
          ? 1
          : Math.min(2, 1.1 + (nextCombo - 3) * .1);
        const comboBonus = Math.round(PUNCH_POINTS[statKey] * (comboScoreMultiplier - 1));
        comboScoreBonusRef.current += comboBonus;
        setComboScoreBonus(comboScoreBonusRef.current);
        const nextScore = Math.max(
          0,
          calculatePunchScore(nextStats)
            + comboScoreBonusRef.current
            - playerKnockdownsRef.current * PLAYER_KNOCKDOWN_SCORE_PENALTY,
        );
        scoreRef.current = nextScore;
        setScore(nextScore);
      }
      setImpact(
        enemyIsGuarding
          ? null
          : isHaymaker || kind === "uppercut" || kind === "power-jab" || kind === "right-hook"
            ? "right"
            : kind === "left-uppercut"
              ? "left"
              : kind,
      );
      setHitStop(true);
      setScreenShake(true);
      const heavyImpact = slipCounter || isHaymaker || kind === "uppercut" || kind === "power-jab";
      triggerRumble(heavyImpact);
      setEnemyPoseSafe(enemyIsGuarding ? "guard" : triggersStumble ? "stumble-back" : kind === "left" || kind === "left-uppercut" || kind === "power-jab" || kind === "left-haymaker" ? "hit-right" : kind === "right" || kind === "right-hook" || kind === "right-haymaker" || kind === "haymaker" || kind === "uppercut" ? "hit-left" : "hit-body");
      playSound("punch");
      setCallout(enemyIsGuarding ? isHaymaker || kind === "uppercut" ? "POWER SHOT BLOCKED!" : "MOHAWK BLOCKS!" : triggersStumble ? "MOHAWK STUMBLES BACK!" : slipCounter ? `SLIP COUNTER +${damage}` : enemyIsOpen ? `COUNTER +${damage}` : kind === "uppercut" ? "SPECIAL UPPERCUT!" : kind === "left-uppercut" ? "LEFT UPPERCUT!" : kind === "right-hook" ? "RIGHT HOOK!" : isHaymaker ? `${kind === "left-haymaker" ? "LEFT" : "RIGHT"} HAYMAKER!` : kind === "power-jab" ? "POWER JAB!" : kind === "body" ? "BODY SHOT" : "CONNECTS");
      window.setTimeout(() => setHitStop(false), heavyImpact ? 88 : 52);
      window.setTimeout(() => setScreenShake(false), heavyImpact ? 135 : 82);
      window.setTimeout(() => setImpact(null), heavyImpact ? 180 : 120);
      if (triggersStumble) {
        window.setTimeout(() => {
          if (matchRef.current === "fighting" && poseRef.current === "stumble-back") setEnemyPoseSafe("idle");
        }, 740);
      }

      if (enemyIsGuarding && isHaymaker) {
        // The blocked haymaker leaves the player fully committed. Mohawk
        // answers immediately with a damaging heavy counter animation.
        window.setTimeout(() => {
          if (matchRef.current !== "fighting") return;
          setEnemyPoseSafe("attack-heavy-contact");
          window.setTimeout(() => {
            if (matchRef.current !== "fighting" || poseRef.current !== "attack-heavy-contact") return;
            setImpact("player");
            setScreenShake(true);
            takePlayerDamage(29);
            playSound("hurt");
            setCallout("PUNISHED!");
            window.setTimeout(() => setImpact(null), 160);
            window.setTimeout(() => setScreenShake(false), 180);
            window.setTimeout(() => {
              if (matchRef.current === "fighting" && poseRef.current === "attack-heavy-contact") setEnemyPoseSafe("idle");
            }, 260);
          }, 125);
        }, 110);
      }

      if (nextHealth <= 0) {
        lastKnockdownPunchRef.current = kind;
        const knockdowns = enemyKnockdownsRef.current + 1;
        enemyKnockdownsRef.current = knockdowns;
        setEnemyKnockdowns(knockdowns);
        if (knockdowns >= 4 && finisherEnabledRef.current) {
          ++playerActionRef.current;
          punchLockRef.current = false;
          bufferedPunchRef.current = null;
          setPlayerPose("idle");
          setFinisherFrame("wobble");
          finisherRunningRef.current = false;
          setFinisherRunning(false);
          matchRef.current = "finisher";
          setMatchState("finisher");
          setCallout("FINISH HIM!");
          playSound("ko");
          return;
        }
        const plan = knockdowns === 1
          ? { health: 75, min: 2, max: 4 }
          : knockdowns === 2
            ? { health: 75, min: 4, max: 6 }
            : knockdowns === 3
              ? { health: 75, min: 6, max: 8 }
              : undefined;
        const riseAt = plan ? plan.min + Math.floor(Math.random() * (plan.max - plan.min + 1)) : null;
        enemyRiseAtRef.current = riseAt;
        enemyRecoveryHealthRef.current = plan?.health ?? 0;
        const nextKneeDepth: KneeDepth =
          kind === "uppercut" || isHaymaker
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
        const currentFightPhase = Math.min(enemyKnockdownsRef.current, 3);
        const postHitGuardChance = currentFightPhase === 1 ? .46 : currentFightPhase === 0 ? .1 : rage ? .24 : .15;
        if (Math.random() < postHitGuardChance) {
          setEnemyPoseSafe("guard");
          window.setTimeout(() => {
            if (matchRef.current === "fighting" && poseRef.current === "guard") setEnemyPoseSafe("idle");
          }, rage ? 380 : 560);
        } else if (poseRef.current.startsWith("hit")) {
          setEnemyPoseSafe("idle");
        }
      }, enemyIsOpen ? 220 : kind === "left" ? 145 : kind === "left-uppercut" ? 210 : kind === "power-jab" ? 210 : kind === "right" ? 210 : kind === "right-hook" ? 230 : isHaymaker || kind === "uppercut" ? 300 : 220);
    }, kind === "left" ? 72 : kind === "left-uppercut" ? 105 : kind === "power-jab" ? 112 : kind === "right" ? 98 : kind === "right-hook" ? 115 : isHaymaker ? 155 : kind === "uppercut" ? 145 : 105);

    // Retract before accepting the buffered strike. Keeping the lock active
    // during this short guard frame guarantees a full extension on every hit,
    // even when the same punch button is being spammed.
    window.setTimeout(() => {
      if (matchRef.current === "fighting" && !blockingRef.current && playerActionRef.current === actionId) {
        setPlayerPose("idle");
      }
    }, kind === "left" ? 145 : kind === "left-uppercut" ? 215 : kind === "power-jab" ? 220 : kind === "right-hook" ? 130 : isHaymaker ? 310 : kind === "uppercut" ? 330 : 175);

    window.setTimeout(() => {
      punchLockRef.current = false;
      const buffered = bufferedPunchRef.current;
      bufferedPunchRef.current = null;
      if (buffered && matchRef.current === "fighting" && !blockingRef.current) punchRef.current(buffered);
    }, kind === "left" ? 205 : kind === "left-uppercut" ? 275 : kind === "power-jab" ? 285 : kind === "right-hook" ? 195 : kind === "haymaker" ? 390 : kind === "uppercut" ? 420 : 235);
  }, [playSound, setEnemyPoseSafe, takePlayerDamage, triggerRumble, triggerSlowMo]);

  useEffect(() => void (punchRef.current = punch), [punch]);

  const beginJabCharge = useCallback(() => {
    if (matchRef.current !== "fighting" || jabChargingRef.current) return;
    if (blockingRef.current) {
      blockingRef.current = false;
      setBlocking(false);
      punch("left-uppercut");
      return;
    }
    if (heldSlipRef.current === "left") {
      punch("left");
      return;
    }
    if (dodgeRef.current) return;
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
  }, [punch]);

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
    if (matchRef.current !== "fighting" || crossChargingRef.current) return;
    if (blockingRef.current) {
      blockingRef.current = false;
      setBlocking(false);
      punch("right-hook");
      return;
    }
    if (heldSlipRef.current === "right") {
      punch("right");
      return;
    }
    if (dodgeRef.current) return;
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
  }, [punch]);

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
    heldSlipRef.current = null;
    setDodgeDirection(null);
      if (matchRef.current === "fighting" && !blockingRef.current && playerActionRef.current === actionId) {
        setPlayerPose("idle");
      }
    }, 300);
  }, [playSound]);

  const beginSlip = useCallback((direction: Exclude<DodgeDirection, null>) => {
    heldSlipRef.current = direction;
    dodge(direction);
  }, [dodge]);

  const endSlip = useCallback((direction: Exclude<DodgeDirection, null>) => {
    if (heldSlipRef.current === direction) heldSlipRef.current = null;
  }, []);

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
    heldSlipRef.current = null;
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
    if (!blockingRef.current) return;
    ++playerActionRef.current;
    blockingRef.current = false;
    setBlocking(false);
    if (matchRef.current === "fighting") setPlayerPose("idle");
  }, []);

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) return;
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (showLeaderboard) {
        event.preventDefault();
        if (key === "escape") setShowLeaderboard(false);
      } else if (key === "escape" && (matchRef.current === "fighting" || matchRef.current === "paused")) {
        event.preventDefault();
        togglePause();
      } else if (matchRef.current === "paused") {
        event.preventDefault();
      } else if (matchRef.current === "player-down") {
        event.preventDefault();
        attemptGetUp();
      } else if (matchRef.current === "finisher") {
        event.preventDefault();
        if (key === "u" || key === "enter" || key === " ") executeFinisher();
        else if (key === "l") executeGroinFinisher();
      } else if (matchRef.current === "intro" && (key === "enter" || key === " ")) {
        event.preventDefault();
        startMatch();
      } else if (key === "a" || key === "arrowleft") beginSlip("left");
      else if (key === "d" || key === "arrowright") beginSlip("right");
      else if (key === "j") beginJabCharge();
      else if (key === "k") beginCrossCharge();
      else if (key === "l") punch("body");
      else if (key === "u") punch("uppercut");
      else if (key === " " || key === "s") {
        event.preventDefault();
        beginBlock();
      }
    };
    const up = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable
      ) return;
      const key = event.key.toLowerCase();
      if (key === " " || key === "s") endBlock();
      else if (key === "k") releaseCrossCharge();
      else if (key === "j") releaseJabCharge();
      else if (key === "a" || key === "arrowleft") endSlip("left");
      else if (key === "d" || key === "arrowright") endSlip("right");
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [attemptGetUp, beginBlock, beginCrossCharge, beginJabCharge, beginSlip, endBlock, endSlip, executeFinisher, executeGroinFinisher, punch, releaseCrossCharge, releaseJabCharge, showLeaderboard, startMatch, togglePause]);

  const displayTimer = Math.max(0, Math.ceil(timer));
  const timerText = endlessFight
    ? "∞"
    : `${Math.floor(displayTimer / 60)}:${String(displayTimer % 60).padStart(2, "0")}`;
  const landedPunches = (Object.keys(punchStats) as (keyof PunchStats)[])
    .reduce((total, key) => total + punchStats[key], 0);
  const punchScore = calculatePunchScore(punchStats);
  const comboDamageDisplay = combo < 3 ? 1 : Math.min(1.25, 1.05 + (combo - 3) * .025);
  const timeBonus = matchState === "won" ? Math.max(0, timer) * TIME_BONUS_PER_SECOND : 0;
  const knockdownPenalty = playerKnockdowns * PLAYER_KNOCKDOWN_SCORE_PENALTY;
  const codesActive = flamingHands || ironJaw || endlessFight || aura || finisherEnabled || brotalityEnabled || slowMo || arcadeMode || rumble || savageSkin;
  const selectedVenue = VENUES.find(({ id }) => id === venue) ?? VENUES[0];
  const rage = enemyHealth <= 35 && enemyHealth > 0;
  const opponentStyle = enemyKnockdowns === 0
    ? "RAPID FIRE"
    : enemyKnockdowns === 1
      ? "CAUTIOUS DEFENSE"
      : enemyKnockdowns === 2
        ? "POWER HUNTER"
        : "UNPREDICTABLE";
  const visionClass = playerHealth <= 20 ? "vision-critical" : playerHealth <= 40 ? "vision-hurt" : "";
  const loadingProgress = Math.round((loadedAssetCount / CORE_POSE_ASSETS.length) * 100);
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
              : enemyPose === "windup-heavy" || enemyPose === "windup-heavy-left"
                ? asset("/opponent-guard.webp")
                : enemyPose === "windup-haymaker-right"
                  ? asset("/opponent-guard.webp")
                  : enemyPose === "windup-haymaker-left"
                    ? asset("/opponent-guard.webp")
                : enemyPose === "attack-heavy" || enemyPose === "attack-heavy-left"
                  ? asset("/opponent-overhand-contact.webp")
                  : enemyPose === "attack-haymaker-right" || enemyPose === "attack-haymaker-right-contact"
                    ? asset("/opponent-haymaker-right-contact.webp")
                    : enemyPose === "attack-haymaker-left" || enemyPose === "attack-haymaker-left-contact"
                      ? asset("/opponent-haymaker-left-contact.webp")
                  : enemyPose === "attack-heavy-contact" || enemyPose === "attack-heavy-left-contact"
                    ? asset("/opponent-overhand-contact.webp")
                    : enemyPose === "attack-left-contact"
                      ? asset("/opponent-jab-contact.webp")
                      : enemyPose === "attack-right-contact"
                        ? asset("/opponent-cross-contact.webp")
                        : enemyPose === "attack-body-contact"
                          ? asset("/opponent-body-contact.webp")
                          : enemyPose === "attack-uppercut-contact"
                            ? asset("/opponent-uppercut-contact.webp")
                  : enemyPose === "windup-uppercut"
                    ? asset("/opponent-uppercut-windup.webp")
                    : enemyPose === "attack-uppercut"
                      ? asset("/opponent-uppercut.webp")
                      : enemyPose === "taunt"
                        ? asset("/opponent-taunt.webp")
                        : enemyPose === "stumble-back"
                          ? asset("/opponent-hit-cross.webp")
                          : enemyPose === "rising" || enemyPose === "failed-rise"
                            ? asset("/opponent-knee-rising.webp")
                            : enemyPose === "knockdown-knee"
                              ? asset("/opponent-knee-breathing.webp")
                        : enemyPose === "hit-right"
                          ? asset("/opponent-hit-jab.webp")
                          : enemyPose === "hit-left"
                            ? asset("/opponent-hit-cross.webp")
                            : enemyPose === "hit-body"
                              ? asset("/opponent-hit-body.webp")
              : asset("/opponent-guard.webp");
  const displayedOpponentAsset = savageSkin ? savageAssetForPose(enemyPose) : opponentAsset;
  const guardLeftAsset = asset("/player-guard-left-v2.webp");
  const guardRightAsset = asset("/player-guard-right-v2.webp");
  const leftArmAsset = playerPose === "left-haymaker"
    ? asset("/player-haymaker-left-arm.webp")
    : playerPose === "left-uppercut"
      ? asset("/player-left-uppercut-arm.webp")
    : playerPose === "jab-left" || playerPose === "power-jab"
    ? asset("/player-jab-left-arm.webp")
    : playerPose === "body-hook"
      ? asset("/player-body-left-arm.webp")
      : guardLeftAsset;
  const rightArmAsset = playerPose === "right-haymaker" || playerPose === "haymaker"
    ? asset("/player-haymaker-right-arm.webp")
    : playerPose === "right-hook"
      ? asset("/player-right-hook-arm.webp")
    : playerPose === "cross-right"
      ? asset("/player-cross-right-arm.webp")
    : guardRightAsset;
  const dragonFrameNumber = mohawkFinisherFrame.startsWith("fatality-")
    ? Number(mohawkFinisherFrame.slice(-2))
    : null;
  const dragonSheetPosition = dragonFrameNumber === null
    ? 0
    : ((dragonFrameNumber - 1) / 6) * 100;

  return (
    <main className={`game-shell venue-${venue} ${performanceMode ? "is-performance" : ""} ${screenShake ? "is-shaking" : ""} ${hitStop ? "is-hit-stop" : ""} ${slowMoActive ? "is-slowmo-active" : ""} ${arcadeMode ? "is-arcade" : ""} ${rumble ? "is-rumble" : ""} ${savageSkin ? "is-savage" : ""} ${visionClass}`}>
      <section
        className={`arena ${selectedVenue.background ? "has-venue-art" : ""} ${matchState === "fighting" ? "is-live" : ""} ${matchState === "finisher" ? "is-finisher" : ""} ${matchState === "mohawk-finisher" ? "is-mohawk-finisher" : ""} ${specialEndingIntro ? "is-special-ending-intro" : ""}`}
        aria-label={`${selectedVenue.label} fight location`}
      >
        {selectedVenue.background && (
          <img className="venue-backdrop" src={asset(selectedVenue.background)} alt="" aria-hidden="true" draggable={false} />
        )}
        <div className="grain" aria-hidden="true" />
        <div className="vision-damage" aria-hidden="true"><i /><b /></div>
        <div className="ceiling-lights" aria-hidden="true"><i /><i /><i /></div>
        <div className={`crowd ${secondWind ? "is-chanting" : ""}`} aria-hidden="true">
          {Array.from({ length: 18 }).map((_, index) => <i key={index} />)}
          {Array.from({ length: 5 }).map((_, index) => (
            <div className={`crowd-chant crowd-chant-${index + 1}`} key={`chant-${index}`}>
              <span className="chant-mo">MO</span><span className="chant-hawk">—HAWK!</span>
            </div>
          ))}
        </div>
        {showPonchCameo && (
          <aside className="ponch-cameo" aria-live="polite">
            <img src={asset("/ponch-crowd-shout.png")} alt="Ponch rises from the crowd to shout encouragement" draggable={false} />
            <div className="ponch-shout">
              <b>PONCH</b>
              <span>“GRAB HIS #!$&amp; AND TWIST IT!!”</span>
            </div>
          </aside>
        )}
        <div className="ring-post post-left" aria-hidden="true" />
        <div className="ring-post post-right" aria-hidden="true" />
        <div className="ropes" aria-hidden="true"><i /><i /><i /></div>
        <div className="ring-floor" aria-hidden="true"><span>BARE KNUCKLE</span></div>
        {specialEndingIntro && <div className="special-ending-spotlight" aria-hidden="true"><i /></div>}

        <header className="fight-hud">
          <div className="fighter-card player-card">
            <div className="name-row"><strong>YOU</strong><span>{Math.ceil(playerHealth)}</span></div>
            <div className="health-track"><span style={{ width: `${playerHealth}%` }} /></div>
            <div className="mini-meter"><em>STAMINA</em><span><i style={{ width: `${stamina}%` }} /></span></div>
            <div className={`mini-meter guard-meter ${aura ? "is-aura-guard" : ""}`}><em>{aura ? "AURA GUARD" : "GUARD"}</em><span><i style={{ width: `${aura ? 100 : guard}%` }} /></span></div>
            <div className={`mini-meter special-meter ${special >= 100 ? "is-ready" : ""}`}><em>{special >= 100 ? "SPECIAL READY" : "SPECIAL"}</em><span><i style={{ width: `${special}%` }} /></span></div>
          </div>

          <div className="round-clock">
            <span>ROUND</span><strong>1</strong><time>{timerText}</time>
          </div>

          <div className={`fighter-card opponent-card ${rage ? "rage" : ""}`}>
            <div className="name-row"><strong>THE MOHAWK</strong><span>{Math.ceil(enemyHealth)}</span></div>
            <div className="health-track"><span style={{ width: `${enemyHealth}%` }} /></div>
            <p>{rage ? `RAGE · ${opponentStyle}` : opponentStyle}</p>
          </div>
        </header>

        {combo >= 3 && matchState === "fighting" && (
          <div className="combo-counter">
            <strong>{combo}</strong>
            <span>HIT COMBO · {comboDamageDisplay.toFixed(2)}× DAMAGE</span>
          </div>
        )}
        {matchState === "fighting" && <div className="score">SCORE {score.toLocaleString()}</div>}
        {matchState === "fighting" && <button className="pause-trigger" onClick={togglePause} aria-label="Pause fight">Ⅱ</button>}
        {matchState === "countdown" && (
          <div className="fight-countdown" role="status" aria-live="assertive">
            <strong key={fightCountdown}>{fightCountdown}</strong>
          </div>
        )}

        <div className={`opponent-shadow ${enemyPose === "knockdown-knee" || enemyPose === "rising" || enemyPose === "failed-rise" ? `shadow-knee-${kneeDepth}` : ""}`} aria-hidden="true" />
        <div className={`opponent-stage pose-${enemyPose} ${enemyPose === "knockdown-knee" || enemyPose === "rising" || enemyPose === "failed-rise" ? `knee-${kneeDepth}` : ""} ${playerPose === "special-uppercut" ? "is-special-contact-hidden" : ""} ${rage ? "is-raging" : ""} ${secondWind && matchState !== "enemy-down" ? "is-second-wind" : ""}`}>
          <img className="opponent-pose-art" src={displayedOpponentAsset} alt={savageSkin ? "Mohawk in his green Savage skin" : "A muscular mohawk fighter in the ring"} draggable={false} />
          <div className="damage-glow" aria-hidden="true" />
          {rage && <div className="rage-aura" aria-hidden="true" />}
        </div>

        {impact && impact !== "player" && (
          <div className={`impact impact-${impact}`} aria-hidden="true">
            <i /><i /><i /><i /><b>POW!</b>
          </div>
        )}
        {impact === "player" && <div className="hurt-flash" aria-hidden="true" />}
        {playerPose === "special-uppercut" && matchState === "fighting" && (
          <img
            className="special-uppercut-contact"
            src={savageSkin ? asset("/savage-special-uppercut-contact.webp") : asset("/player-special-uppercut-contact.webp")}
            alt={`The player's right uppercut connecting beneath ${savageSkin ? "Savage Mohawk's" : "Mohawk's"} chin`}
            draggable={false}
          />
        )}

        {haymakerCharging && matchState === "fighting" && (
          <div className="haymaker-charge-meter" aria-live="polite"><span /><b>HAYMAKER</b></div>
        )}
        {jabCharging && matchState === "fighting" && (
          <div className="jab-charge-meter" aria-live="polite"><span /><b>POWER JAB</b></div>
        )}

        {matchState !== "won" && matchState !== "lost" && (
          <>
          {aura && <div className="player-aura-effect" aria-hidden="true"><i /><i /></div>}
          <div className={`first-person-body player-${playerPose} ${flamingHands ? "has-flaming-hands" : ""}`} aria-hidden="true">
            {matchState === "player-down" ? (
              <img className="player-pose-art player-knockdown-art" src={asset("/player-knockdown-arms.webp")} alt="" draggable={false} />
            ) : playerPose === "hit" ? (
              <img className="player-pose-art player-hit-art" src={asset("/player-hit.webp")} alt="" draggable={false} />
            ) : (
              <>
                <img className={`player-pose-art player-arm-art player-left-art ${leftArmAsset === guardLeftAsset ? "player-guard-arm" : ""}`} src={leftArmAsset} alt="" draggable={false} />
                <img className={`player-pose-art player-arm-art player-right-art ${rightArmAsset === guardRightAsset ? "player-guard-arm" : ""}`} src={rightArmAsset} alt="" draggable={false} />
              </>
            )}
            <img className="player-pose-art player-block-art" src={asset("/player-block.webp")} alt="" draggable={false} />
            {flamingHands && (
              <>
                <span className="hand-flames flame-left"><i /><i /><i /></span>
                <span className="hand-flames flame-right"><i /><i /><i /></span>
              </>
            )}
          </div>
          </>
        )}

        {matchState === "fighting" && (
          <div className="controls" aria-label="Fight controls">
            <div className="move-controls">
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginSlip("left"); }}
                onPointerUp={() => endSlip("left")}
                onPointerLeave={() => endSlip("left")}
                onPointerCancel={() => endSlip("left")}
                aria-label="Hold slip left"
              ><kbd>A</kbd><span>SLIP LEFT</span></button>
              <button
                onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); beginSlip("right"); }}
                onPointerUp={() => endSlip("right")}
                onPointerLeave={() => endSlip("right")}
                onPointerCancel={() => endSlip("right")}
                aria-label="Hold slip right"
              ><kbd>D</kbd><span>SLIP RIGHT</span></button>
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

        {matchState === "finisher" && (
          <div className={`finisher-sequence frame-${finisherFrame} ${finisherRunning ? "is-running" : ""}`} aria-live="assertive">
            <img src={asset(`/finisher-${finisherFrame}.png`)} alt="" draggable={false} />
            {finisherFrame === "wobble" && (
              <div className="finish-him-lockup">
                <strong>FINISH HIM!</strong>
                <span><kbd>U</kbd> TABLE FINISHER · <kbd>L</kbd> BODY FINISHER</span>
                <div className="finisher-actions">
                  <button onClick={executeFinisher}>TABLE FINISHER</button>
                  <button onClick={executeGroinFinisher}>BODY FINISHER</button>
                </div>
              </div>
            )}
          </div>
        )}

        {matchState === "mohawk-finisher" && (
          <div className={`mohawk-finisher-sequence ${dragonFrameNumber !== null ? "is-dragon-fatality" : ""} frame-${mohawkFinisherFrame}`} aria-live="assertive">
            {dragonFrameNumber !== null ? (
              <div
                className="dragon-fatality-frame"
                style={{
                  backgroundImage: `url(${asset("/mohawk-fatality-simple.webp")})`,
                  backgroundPosition: `${dragonSheetPosition}% center`,
                }}
                aria-hidden="true"
              />
            ) : (
              <img
                src={asset(`/mohawk-finisher-${mohawkFinisherFrame}.${mohawkFinisherFrame.startsWith("brotality-") ? "webp" : "png"}`)}
                alt=""
                draggable={false}
              />
            )}
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
                <section><strong>RAGE MODE</strong><span>A red glow marks Rage Mode. When their health gets low, some fighters may attack faster, hit harder, guard more aggressively, and recover sooner.</span></section>
                <section><strong>CHARGED SHOTS</strong><span>Hold J for a power jab. Hold K for a haymaker. A blocked haymaker invites a heavy counter.</span></section>
                <section><strong>SPECIAL</strong><span>Landed punches fill the purple meter. At 100%, press U for the finishing uppercut.</span></section>
                <section><strong>DEFENSE</strong><span>Hold Space to block. Slip with A/D; a successful slip powers up your next counter.</span></section>
                <section><strong>GUARD INDICATOR</strong><span>A gold halo flashes when an opponent raises their guard. Normal punches may be blocked until the guard opens.</span></section>
              </div>
              <button className="fight-button" onClick={togglePause}>RETURN TO FIGHT <i>›</i></button>
              <button className="quit-fight-button" onClick={returnToMenu}>QUIT TO MAIN MENU</button>
              <small>PRESS ESC TO RESUME</small>
            </div>
          </div>
        )}

        {matchState === "enemy-down" && (
          <div className="enemy-count-overlay" aria-live="assertive">
            <strong>{enemyCount}</strong>
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
            <img className="intro-mohawk" src={savageSkin ? asset("/savage-guard.webp") : asset("/opponent-guard.webp")} alt="The Mohawk waiting in the ring" draggable={false} />
            <div className="title-lockup">
              <img className="intro-logo" src={asset("/fighttime-logo.png")} alt="FightTime" draggable={false} />
              <span className="intro-version">VERSION {GAME_VERSION}</span>
            </div>
            <div className="intro-versus-card">
              <div className="versus-row"><strong>YOU</strong><b>VS</b><strong>THE MOHAWK</strong></div>
              <div className="how-to">
                <div><kbd>A</kbd><kbd>D</kbd><span>SLIP</span></div>
                <div><kbd>J</kbd><kbd>K</kbd><kbd>L</kbd><span>STRIKE</span></div>
                <div><kbd>S</kbd><kbd>SPACE</kbd><span>BLOCK</span></div>
              </div>
              <div className="venue-picker" aria-label="Choose fight location">
                <strong>FIGHT LOCATION</strong>
                <div>
                  {VENUES.map((venueOption) => {
                    const unlocked = venueOption.id === "arena"
                      || venueUnlocks[venueOption.id as UnlockableVenue];
                    return (
                      <button
                        type="button"
                        className={`${venue === venueOption.id ? "is-selected" : ""} ${unlocked ? "" : "is-locked"}`.trim()}
                        aria-pressed={unlocked && venue === venueOption.id}
                        aria-label={unlocked ? venueOption.label : `Locked venue. ${venueOption.achievement}`}
                        disabled={!unlocked}
                        onClick={() => {
                          if (!unlocked) return;
                          setVenue(venueOption.id);
                          if (venueOption.background) warmAssets([asset(venueOption.background)]);
                        }}
                        key={venueOption.id}
                      >
                        <span>{unlocked ? venueOption.label : "🔒 ???"}</span>
                        {!unlocked && <small>{venueOption.achievement}</small>}
                      </button>
                    );
                  })}
                </div>
              </div>
              <button className="fight-button intro-fight-button" onClick={startMatch}>ENTER THE RING <i>›</i></button>
              <button className="local-scores-button" onClick={() => setShowLeaderboard(true)}>LOCAL TOP 10</button>
              <button className="secret-code-button" onClick={() => setShowCodeEntry((value) => !value)}>ENTER CODE</button>
              {showCodeEntry && (
                <form
                  className="secret-code-form"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!activateSecretCode(secretCode)) {
                      setSecretConfirmation("INVALID CODE");
                      window.clearTimeout(secretConfirmationTimerRef.current);
                      secretConfirmationTimerRef.current = window.setTimeout(() => setSecretConfirmation(""), 1400);
                    }
                  }}
                >
                  <input
                    value={secretCode}
                    onChange={(event) => setSecretCode(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 16))}
                    aria-label="Secret code"
                    placeholder="ENTER SECRET CODE"
                    autoComplete="off"
                  />
                  <button type="submit">ACTIVATE</button>
                </form>
              )}
              {secretConfirmation && <div className="secret-confirmation" role="status">{secretConfirmation}</div>}
              {(flamingHands || ironJaw || endlessFight || aura || finisherEnabled || brotalityEnabled || slowMo || arcadeMode || rumble || savageSkin) && (
                <div className="active-secrets" aria-label="Active secret powers">
                  {flamingHands && <button type="button" onClick={() => deactivateSecretCode("flameon")} aria-label="Deactivate Flaming Hands"><span>🔥 FLAMING HANDS</span><b aria-hidden="true">×</b></button>}
                  {ironJaw && <button type="button" onClick={() => deactivateSecretCode("ironjaw")} aria-label="Deactivate Iron Jaw"><span>◆ IRON JAW</span><b aria-hidden="true">×</b></button>}
                  {endlessFight && <button type="button" onClick={() => deactivateSecretCode("timeless")} aria-label="Deactivate Timeless"><span>∞ TIMELESS</span><b aria-hidden="true">×</b></button>}
                  {aura && <button type="button" onClick={() => deactivateSecretCode("aura")} aria-label="Deactivate Aura"><span>◉ AURA</span><b aria-hidden="true">×</b></button>}
                  {finisherEnabled && <button type="button" onClick={() => deactivateSecretCode("fatality")} aria-label="Deactivate Fatality"><span>☠ FATALITY</span><b aria-hidden="true">×</b></button>}
                  {brotalityEnabled && <button type="button" onClick={() => deactivateSecretCode("brotality")} aria-label="Deactivate Brotality"><span>★ BROTALITY</span><b aria-hidden="true">×</b></button>}
                  {slowMo && <button type="button" onClick={() => deactivateSecretCode("slowmo")} aria-label="Deactivate Slowmo"><span>◷ SLOWMO</span><b aria-hidden="true">×</b></button>}
                  {arcadeMode && <button type="button" onClick={() => deactivateSecretCode("arcade")} aria-label="Deactivate Arcade"><span>▦ ARCADE</span><b aria-hidden="true">×</b></button>}
                  {rumble && <button type="button" onClick={() => deactivateSecretCode("rumble")} aria-label="Deactivate Rumble"><span>〰 RUMBLE</span><b aria-hidden="true">×</b></button>}
                  {savageSkin && <button type="button" onClick={() => deactivateSecretCode("savage")} aria-label="Deactivate Savage Skin"><span>◆ SAVAGE SKIN</span><b aria-hidden="true">×</b></button>}
                </div>
              )}
              <small>{endlessFight ? "1 ROUND · INFINITE TIME · FIGHT FOREVER" : "1 ROUND · 90 SECONDS · SURVIVE THE STORM"}</small>
            </div>
          </div>
        )}

        {(matchState === "won" || matchState === "lost") && (
          <div className={`overlay result-overlay ${matchState}`}>
            {matchState === "lost" ? (
              <>
                <div className="defeat-scene" aria-hidden="true">
                  <div className="victory-mohawk-stage">
                    <img className="victory-mohawk victory-both" src={savageSkin ? asset("/savage-heavy.webp") : asset("/opponent-victory.webp")} alt="" draggable={false} />
                    <img className="victory-mohawk victory-left" src={savageSkin ? asset("/savage-guard.webp") : asset("/opponent-victory-left.webp")} alt="" draggable={false} />
                    <img className="victory-mohawk victory-right" src={savageSkin ? asset("/savage-heavy.webp") : asset("/opponent-victory-right.webp")} alt="" draggable={false} />
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
                    <span><em>PLAYER KNOCKDOWNS</em><strong>{playerKnockdowns}</strong></span>
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
                  <img className="sportsmanship-mohawk" src={savageSkin ? asset("/savage-guard.webp") : asset("/opponent-sportsmanship.webp")} alt="Mohawk after a great fight" draggable={false} />
                  <div className="mohawk-speech">
                    <strong>MOHAWK</strong>
                    <p>Great fight! I&apos;ll be back for a rematch soon.</p>
                  </div>
                </div>
                <img className="player-holds-belt" src={asset("/player-holds-belt.webp")} alt="The player holding the gold championship belt" draggable={false} />
                <div className="champion-copy">
                  <h2 className="simple-win-title">YOU WIN!!!</h2>
                  <div className="win-scorecard">
                    <h3>OFFICIAL SCORECARD</h3>
                    <div className="scorecard-grid">
                      <span><em>LANDED PUNCHES</em><strong>{landedPunches}</strong></span>
                      <span><em>PUNCH POINTS</em><strong>{punchScore.toLocaleString()}</strong></span>
                      <span><em>COMBO BONUS</em><strong className="score-bonus">+{comboScoreBonus.toLocaleString()}</strong></span>
                      <span><em>TIME BONUS</em><strong>+{timeBonus.toLocaleString()}</strong></span>
                      <span><em>KNOCKDOWNS</em><strong className="score-penalty">{knockdownPenalty === 0 ? "0" : `−${knockdownPenalty.toLocaleString()}`}</strong></span>
                    </div>
                    <div className="scorecard-total"><em>FINAL SCORE</em><strong>{score.toLocaleString()}</strong></div>
                    {achievementNotice && (
                      <div className="achievement-unlocked">
                        <strong>VENUE UNLOCKED</strong>
                        <span>{achievementNotice}</span>
                      </div>
                    )}
                    {showRematch && awaitingInitials && (
                      <form className="initials-entry" onSubmit={(event) => { event.preventDefault(); submitLocalScore(); }}>
                        <label htmlFor="arcade-initials">NEW LOCAL HIGH SCORE — ENTER INITIALS</label>
                        <input
                          id="arcade-initials"
                          value={initials}
                          onChange={(event) => setInitials(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3))}
                          maxLength={3}
                          inputMode="text"
                          autoComplete="off"
                          autoFocus
                          aria-label="Enter three initials"
                        />
                        <button type="submit" disabled={initials.length !== 3}>SAVE SCORE</button>
                      </form>
                    )}
                    {leaderboardSubmitted && <div className="score-saved">SCORE SAVED TO LOCAL TOP 10</div>}
                    {codesActive && <div className="score-ineligible">CODES ACTIVE · SCORE NOT ELIGIBLE FOR LOCAL TOP 10</div>}
                    <button className="view-scores-button" onClick={() => setShowLeaderboard(true)}>VIEW LOCAL TOP 10</button>
                  </div>
                  {showRematch && !awaitingInitials ? (
                    <div className="result-actions">
                      <button className="fight-button rematch-button" onClick={startMatch}>DEFEND THE TITLE <i>↻</i></button>
                      <button className="fight-button menu-button" onClick={returnToMenu}>MAIN MENU <i>‹</i></button>
                    </div>
                  ) : !showRematch ? (
                    <div className="victory-delay" role="status">THE CROWD ERUPTS...</div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {showLeaderboard && (
          <div className="overlay leaderboard-overlay" role="dialog" aria-modal="true" aria-labelledby="local-leaderboard-title">
            <div className="leaderboard-card">
              <button className="leaderboard-close" onClick={() => setShowLeaderboard(false)} aria-label="Close leaderboard">×</button>
              <p>FIGHTTIME ARCADE RECORDS</p>
              <h2 id="local-leaderboard-title">LOCAL TOP 10</h2>
              <div className="leaderboard-head"><span>RANK</span><span>INITIALS</span><span>SCORE</span></div>
              <ol>
                {Array.from({ length: 10 }).map((_, index) => {
                  const entry = leaderboard[index];
                  return (
                    <li key={`${entry?.date || "empty"}-${index}`} className={entry?.score === score && leaderboardSubmitted ? "is-new-score" : ""}>
                      <b>{String(index + 1).padStart(2, "0")}</b>
                      <strong>{entry?.initials || "---"}</strong>
                      <span>{entry ? entry.score.toLocaleString() : "0"}</span>
                    </li>
                  );
                })}
              </ol>
              <small>SAVED ON THIS DEVICE</small>
              <button className="fight-button" onClick={() => setShowLeaderboard(false)}>BACK <i>‹</i></button>
            </div>
          </div>
        )}

        <div className="corner-label">FIRST-PERSON ARCADE BOXING · {audioReady ? "SOUND ON" : "SOUND READY"}</div>
      </section>
    </main>
  );
}
