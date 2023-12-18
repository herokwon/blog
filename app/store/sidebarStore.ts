import { create } from "zustand";

interface SidebarState {
    sidebarActive: boolean;
    setSidebarActive: (state: boolean) => void;
};

export const useSidebar = create<SidebarState>((set) => ({
    sidebarActive: false,
    setSidebarActive: (state: boolean) => {
        set(() => ({ sidebarActive: state }));
    },
}));

export default useSidebar;