"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Pictogram } from "./Pictogram";
import { UI, type Lang } from "./strings";
import styles from "./farmer.module.css";

const supported = () => typeof window !== "undefined" && "speechSynthesis" in window;

function findVoice(lang: Lang): SpeechSynthesisVoice | null {
  if (!supported()) return null;
  const prefix = lang === "kn" ? "kn" : "en";
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(prefix));
  return voices.find((v) => v.lang.toLowerCase() === (lang === "kn" ? "kn-in" : "en-in")) ?? voices[0] ?? null;
}

/** Re-renders when the browser finishes loading its voice list (it loads asynchronously). */
function useVoicesVersion(): number {
  return useSyncExternalStore(
    (onChange) => {
      if (!supported()) return () => {};
      const synth = window.speechSynthesis;
      synth.addEventListener("voiceschanged", onChange);
      return () => synth.removeEventListener("voiceschanged", onChange);
    },
    () => (supported() ? window.speechSynthesis.getVoices().length : 0),
    () => 0,
  );
}

/**
 * Reads `text` aloud with the device's own text-to-speech. The button appears only when the device
 * has a voice for the chosen language (many Windows PCs and phones have no Kannada voice); otherwise
 * a short note says read-aloud is unavailable, so the feature never looks silently broken.
 */
export function SpeakButton({ text, lang }: { text: string; lang: Lang }) {
  const voiceCount = useVoicesVersion();
  const voice = findVoice(lang);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => () => {
    if (supported()) window.speechSynthesis.cancel();
  }, []);

  if (!voice) {
    // While the voice list is still loading (count 0), show nothing rather than a false "unavailable".
    if (supported() && voiceCount === 0) return null;
    return (
      <p className={styles.noVoice} role="note">
        {UI.noVoice[lang]}
      </p>
    );
  }

  function toggle() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = voice;
    utterance.lang = voice!.lang;
    utterance.rate = 0.9;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  return (
    <button type="button" className={styles.speak} onClick={toggle} aria-pressed={speaking}>
      <Pictogram name="speaker" size={28} />
      <span>{speaking ? UI.stop[lang] : UI.listen[lang]}</span>
    </button>
  );
}
