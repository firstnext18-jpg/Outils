// Page « Adresse du serveur » : seules ces deux fonctions lui sont exposées.
"use strict";

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("reglages", {
  lire: () => ipcRenderer.invoke("reglages:lire"),
  enregistrer: (adresse) => ipcRenderer.invoke("reglages:enregistrer", String(adresse ?? "")),
});
