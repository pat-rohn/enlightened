

export interface Device {
  Address: string;
  Name: string;
  ApiToken?: string;
}

export interface Settings {
  CurrentDevice: Device;
  KnownDevices: Device[];
}

export interface DaySetting {
  AlarmTime: string;
  IsActive: boolean;
}

export interface Light {
  Red: number
  Green: number
  Blue: number
}

export interface SunriseSettings {
  IsActivated: boolean;
  SunriseLightTime: number;
  Monday: DaySetting;
  Tuesday: DaySetting;
  Wednesday: DaySetting;
  Thursday: DaySetting;
  Friday: DaySetting;
  Saturday: DaySetting;
  Sunday: DaySetting;
}


export interface DeviceSettings {
  IsConfigured: boolean;
  ServerAddress: string;
  SensorID: string;
  WiFiName: string;
  WiFiPassword: string;
  ApiToken: string;
  HasWiFiPassword?: boolean;
  HasApiToken?: boolean;
  DhtPin: number;
  SerialRX: number;
  SerialTX: number;
  AnalogSensorPin0: number;
  AnalogSensorPin1: number;
  WindSensorPin: number;
  RainfallSensorPin: number;
  LEDPin: number;
  OneWirePin: number;
  Button1: number;
  Button2: number;
  Button2GetURL: string
  NumberOfLEDs: number;
  FindSensors: boolean;
  IsOfflineMode: boolean;
  ShowWebpage: boolean;
  UseMQTT: boolean;
  MQTTTopic: string;
  MQTTPort: number;
  SunriseSettings: SunriseSettings;
  LightLow: Light;
  LightMedium: Light;
  LightHigh: Light;
  DeepSleepTime: number;
  BufferedValues: number;
  MeasureInterval: number;
}
