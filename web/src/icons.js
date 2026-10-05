// Icon set (Lucide, ISC license), inlined at build time.

import bellOff from 'lucide-static/icons/bell-off.svg?raw';
import bell from 'lucide-static/icons/bell.svg?raw';
import blocks from 'lucide-static/icons/blocks.svg?raw';
import bookOpen from 'lucide-static/icons/book-open.svg?raw';
import brain from 'lucide-static/icons/brain.svg?raw';
import chevronDown from 'lucide-static/icons/chevron-down.svg?raw';
import circleCheck from 'lucide-static/icons/circle-check.svg?raw';
import circleHelp from 'lucide-static/icons/circle-help.svg?raw';
import clock from 'lucide-static/icons/clock.svg?raw';
import coffee from 'lucide-static/icons/coffee.svg?raw';
import cpu from 'lucide-static/icons/cpu.svg?raw';
import eye from 'lucide-static/icons/eye.svg?raw';
import gauge from 'lucide-static/icons/gauge.svg?raw';
import globe from 'lucide-static/icons/globe.svg?raw';
import hand from 'lucide-static/icons/hand.svg?raw';
import hourglass from 'lucide-static/icons/hourglass.svg?raw';
import house from 'lucide-static/icons/house.svg?raw';
import keyboard from 'lucide-static/icons/keyboard.svg?raw';
import layers from 'lucide-static/icons/layers.svg?raw';
import moon from 'lucide-static/icons/moon.svg?raw';
import navigation from 'lucide-static/icons/navigation.svg?raw';
import panelLeft from 'lucide-static/icons/panel-left.svg?raw';
import pencil from 'lucide-static/icons/pencil.svg?raw';
import sparkles from 'lucide-static/icons/sparkles.svg?raw';
import sun from 'lucide-static/icons/sun.svg?raw';
import sunrise from 'lucide-static/icons/sunrise.svg?raw';
import sunset from 'lucide-static/icons/sunset.svg?raw';
import terminal from 'lucide-static/icons/terminal.svg?raw';
import triangleAlert from 'lucide-static/icons/triangle-alert.svg?raw';
import users from 'lucide-static/icons/users.svg?raw';
import wifiOff from 'lucide-static/icons/wifi-off.svg?raw';
import x from 'lucide-static/icons/x.svg?raw';
import zap from 'lucide-static/icons/zap.svg?raw';

const RAW = {
  bellOff, bell, blocks, bookOpen, brain, chevronDown, circleCheck, circleHelp, clock, coffee, cpu, eye, gauge,
  globe, hand, hourglass, house, keyboard, layers, moon, navigation, panelLeft, pencil, sparkles, sun, sunrise,
  sunset, terminal, triangleAlert, users, wifiOff, x, zap,
};

const cache = {};
/** Inline SVG markup for an icon, sized by CSS (1em by default). */
export function icon(name, cls = '') {
  const key = `${name}|${cls}`;
  if (!cache[key]) {
    const raw = RAW[name] || RAW.sparkles;
    cache[key] = raw
      .replace(/<!--.*?-->/s, '')
      .replace(/class="[^"]*"/, `class="icon${cls ? ` ${cls}` : ''}" aria-hidden="true"`)
      .replace(/width="24"\s*height="24"/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }
  return cache[key];
}

/** Icon for each canonical state (plus off_duty). */
export const STATE_ICON = {
  idle: 'coffee',
  thinking: 'brain',
  reading: 'bookOpen',
  editing: 'keyboard',
  running: 'terminal',
  searching: 'globe',
  delegating: 'users',
  waiting_for_user: 'hand',
  error: 'triangleAlert',
  done: 'circleCheck',
  off_duty: 'moon',
};
