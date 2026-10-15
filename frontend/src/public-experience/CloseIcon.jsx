/* eslint-disable no-restricted-globals -- isolated imported public demonstration */
import React from 'react';
import './close-controls.css';

// A symmetric drawing avoids font baselines moving the close mark off-centre.
export default function CloseIcon() {
  return <svg className="nc-close-icon" viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true" focusable="false"><path d="M5 5 15 15M15 5 5 15"/></svg>;
}
