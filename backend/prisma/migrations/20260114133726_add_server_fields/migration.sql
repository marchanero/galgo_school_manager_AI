-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_mqtt_config" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL DEFAULT 'Servidor Principal',
    "broker" TEXT NOT NULL DEFAULT 'mqtt://100.82.84.24:1883',
    "username" TEXT NOT NULL DEFAULT 'admin',
    "password" TEXT NOT NULL DEFAULT 'galgo2526',
    "clientId" TEXT NOT NULL DEFAULT 'camera_rtsp_server',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_mqtt_config" ("broker", "clientId", "createdAt", "id", "isActive", "password", "updatedAt", "username") SELECT "broker", "clientId", "createdAt", "id", "isActive", "password", "updatedAt", "username" FROM "mqtt_config";
DROP TABLE "mqtt_config";
ALTER TABLE "new_mqtt_config" RENAME TO "mqtt_config";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
