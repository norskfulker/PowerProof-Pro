"use client";

import { createContext, useContext } from "react";

/** Inside Settings: a page's own title is a section heading under the one "Settings" title */
export const InSettings = createContext(false);
export const useInSettings = () => useContext(InSettings);
