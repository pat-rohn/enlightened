
export enum LEDMode {
  on = 0,
  off,
  campfire,
  colorful,
  sunrise,
  pulse,
}

export interface LabeledLedMode {
  label: string;
  id: LEDMode
}

export interface LEDStatusJSON {
  Red: number;
  Green: number;
  Blue: number;
  Brightness: number;
  Mode: number;
  Message: string;
}

export interface LEDStatus {
  red: number;
  green: number;
  blue: number;
  brightness: number;
  mode: LabeledLedMode;
  message: string;
}

export const LED_ON: LabeledLedMode = { label: "on", id: LEDMode.on };
export const LED_OFF: LabeledLedMode = { label: "off", id: LEDMode.off };
export const LED_CAMPFIRE: LabeledLedMode = { label: "campfire", id: LEDMode.campfire };
export const LED_COLORS: LabeledLedMode = { label: "colorful", id: LEDMode.colorful };
export const LED_SUNRISE: LabeledLedMode = { label: "sunrise", id: LEDMode.sunrise };
export const LED_PULSE: LabeledLedMode = { label: "pulse", id: LEDMode.pulse };

export enum Level {
  First = 0,
  Second = 1,
  Third = 2,
}

export interface LightLevel {
  label: string;
  id: Level
}

export const LIGHT_FIRST: LightLevel = { label: "first", id: Level.First };
export const LIGHT_SECOND: LightLevel = { label: "second", id: Level.Second };
export const LIGHT_THIRD: LightLevel = { label: "third", id: Level.Third };

