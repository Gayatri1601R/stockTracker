// context/AppContext.js
import React, { createContext, useState } from "react";

export const AppContext = createContext();

export const AppProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [items, setItems] = useState([]);

  return (
    <AppContext.Provider value={{ user, setUser, items, setItems }}>
      {children}
    </AppContext.Provider>
  );
};