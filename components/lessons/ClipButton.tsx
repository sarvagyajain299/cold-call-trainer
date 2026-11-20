"use client";

import { Play, Square } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Clip } from "@/lib/lessons/model";

type Player = { play: (clip: Clip) => void; stop: () => void; playing: Clip | null; available: boolean };

const PlayerContext = createContext<Player>({ play: () => {}, stop: () => {}, playing: null, available: false });

/** One shared <audio> for the whole lesson, so two clips never talk over each other. */
export function CallAudioProvider({ src, available, children }: { src: string; available: boolean; children: ReactNode }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<Clip | null>(null);
  const [ok, setOk] = useState(available);
  const endAt = useRef(0);

  const stop = useCallback(() => {
    audio.current?.pause();
    setPlaying(null);
  }, []);

  const play = useCallback((clip: Clip) => {
    const el = audio.current;
    if (!el) return;
    endAt.current = clip.end;
    el.currentTime = clip.t;
    setPlaying(clip);
    el.play().catch(() => setPlaying(null));
  }, []);

  useEffect(() => () => audio.current?.pause(), []);

  return (
    <PlayerContext.Provider value={{ play, stop, playing, available: ok }}>
      {available && (
        <audio
          ref={audio}
          src={src}
          preload="metadata"
          onError={() => {
            setOk(false);
            setPlaying(null);
          }}
          onTimeUpdate={(e) => {
            if (e.currentTarget.currentTime >= endAt.current) stop();
          }}
          onEnded={() => setPlaying(null)}
          hidden
        />
      )}
      {children}
    </PlayerContext.Provider>
  );
}

/** ▶ for one moment of the real call. Hidden when the call audio is not available. */
export function ClipButton({ clip, label }: { clip?: Clip; label: string }) {
  const { play, stop, playing, available } = useContext(PlayerContext);
  if (!clip || !available) return null;
  const on = playing?.t === clip.t && playing.end === clip.end;
  return (
    <button
      type="button"
      onClick={() => (on ? stop() : play(clip))}
      aria-label={on ? `Stop ${label}` : `Play ${label}`}
      className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-ios-fill px-4 text-[15px] font-medium text-ios-blue"
    >
      {on ? <Square size={14} aria-hidden fill="currentColor" /> : <Play size={16} aria-hidden fill="currentColor" />}
      {on ? "Stop" : "Hear it"}
    </button>
  );
}
