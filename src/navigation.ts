import type { NavigatorScreenParams } from '@react-navigation/native';

// Cleaning tab: existing stack — preserved as-is.
export type CleaningStackParamList = {
  Home: undefined;
  CleaningFlow: { roomId: string };
};

export type InventoryStackParamList = {
  InventoryList: undefined;
  InventoryDetail: { itemId: string };
};

export type LaundryStackParamList = {
  LaundryList: undefined;
  LaundryDetail: { itemId: string };
};

export type TeamStackParamList = {
  Team: undefined;
};

export type RootTabParamList = {
  CleaningTab: NavigatorScreenParams<CleaningStackParamList>;
  TeamTab: NavigatorScreenParams<TeamStackParamList>;
};

// Back-compat: existing screens type their props against RootStackParamList.
// Keep the alias so we don't have to rewire every screen.
export type RootStackParamList = CleaningStackParamList;
