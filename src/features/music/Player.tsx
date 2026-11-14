import { useState } from 'react';
import { music, useMusic } from './music';
import { IconMusic, IconPause, IconPlay, IconVolume, IconMute, IconChevronDown, IconX } from '../../lib/icons';
import { useProgress } from '../progress/store';
import { setSfxEnabled } from './sfx';

export function Player() {
  const { tracks, playing, loading, track, volume, nudge, error } = useMusic();
  const sfxOn = useProgress((s) => s.settings.sfxOn);
  const setSettings = useProgress((s) => s.setSettings);
  const [open, setOpen] = useState(false);
  const cur = tracks.find((t) => t.id === track) ?? tracks[0];

  return (
    <>
      {nudge && !playing && (
        <div className="panel music-nudge" role="dialog" aria-label="背景音樂">
          <IconMusic size={18} />
          <span>要開「機器人工程師專注音樂」嗎？</span>
          <button className="btn sm primary" onClick={() => music.play()}>開啟</button>
          <button className="btn sm icon ghost" onClick={() => music.dismissNudge()} aria-label="不用了"><IconX size={14} /></button>
        </div>
      )}
      <div className={`panel player ${open ? '' : 'min'}`}>
        <div className="player-top">
          <button className="btn icon" onClick={() => music.toggle()} aria-label={playing ? '暫停音樂' : '播放音樂'} title={playing ? '暫停' : '播放專注音樂'}>
            {playing || loading ? <IconPause size={14} /> : <IconPlay size={14} />}
          </button>
          {open ? (
            <div className="player-title">
              <b>{cur.title}</b>
              <small>{loading ? '載入中…' : error ?? cur.subtitle}</small>
            </div>
          ) : null}
          <div className={`eq ${playing ? '' : 'paused'}`} aria-hidden><i /><i /><i /><i /></div>
          <button className="btn sm icon ghost" onClick={() => setOpen(!open)} aria-label={open ? '收合' : '展開播放器'} aria-expanded={open}>
            {open ? <IconChevronDown size={14} /> : <IconMusic size={14} />}
          </button>
        </div>
        {open && (
          <>
            <div className="tracks">
              {tracks.map((t) => (
                <button key={t.id} className={t.id === track ? 'on' : ''} onClick={() => music.select(t.id)}>
                  <span>{t.title}</span>
                  <small>{t.subtitle}</small>
                </button>
              ))}
            </div>
            <div className="vol">
              <IconVolume size={14} />
              <input type="range" min={0} max={1} step={0.01} value={volume} onChange={(e) => music.setVolume(+e.target.value)} aria-label="音量" />
            </div>
            <div className="vol">
              <button className="btn sm ghost" onClick={() => { setSfxEnabled(!sfxOn); setSettings({ sfxOn: !sfxOn }); }} aria-pressed={sfxOn}>
                {sfxOn ? <IconVolume size={13} /> : <IconMute size={13} />} 音效{sfxOn ? '開' : '關'}
              </button>
              <span className="dim" style={{ marginLeft: 'auto', fontSize: 11 }}>原創配樂 · 程式合成</span>
            </div>
          </>
        )}
      </div>
    </>
  );
}
