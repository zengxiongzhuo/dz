import React from 'react';
import { avatars } from '../data/avatars.js';

// 头像选择网格：5列 x 4行
export default function AvatarPicker({ value, onChange }) {
  return (
    <div className="avatar-grid">
      {avatars.map((a) => {
        const active = value === a.id;
        return (
          <button
            key={a.id}
            type="button"
            className={`avatar-cell ${active ? 'is-active' : ''}`}
            onClick={() => onChange(a.id)}
            aria-label={a.name}
            title={a.name}
          >
            <span className="avatar-emoji" role="img" aria-hidden="true">
              {a.emoji}
            </span>
            {active && <span className="avatar-ring" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}
