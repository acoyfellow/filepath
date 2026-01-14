export interface Tab {
  id: string;
  name: string;
}

export interface Session {
  id: string;
  password?: string; // optional password
  tabs: Tab[];
  activeTab: number; // index into tabs array
}