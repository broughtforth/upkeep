// The mobile app has a single stack: Home → CleaningFlow.
// Team / Inventory / Laundry have been removed.
export type CleaningStackParamList = {
  Home: undefined;
  // CleaningFlow loads from Supabase using the task_instance id passed here.
  // The room name + subtasks come from the joined template/room rows.
  CleaningFlow: { instanceId: string };
};

// Back-compat: existing screens type their props against RootStackParamList.
export type RootStackParamList = CleaningStackParamList;
