import { createContext, useContext } from "react";
export const OptionsCtx = createContext({});
export const useAdminOptions = () => useContext(OptionsCtx);
