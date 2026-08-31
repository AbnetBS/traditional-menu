"use client";

import { useEffect, useRef, useState } from "react";
import { RESTAURANT } from "@/lib/restaurant";

interface NotificationProps {
  message: string;
  title?: string;
  icon?: string;
}

export function triggerDesktopNotification({ message, title = `${RESTAURANT.identity.name} Alert`, icon = "/favicon.ico" }: NotificationProps) {
  if (typeof window === "undefined" || !("Notification" in window)) return;

  // Request permission if not already granted
  if (Notification.permission === "default") {
    Notification.requestPermission();
    return;
  }

  if (Notification.permission === "granted") {
    try {
      new Notification(title, {
        body: message,
        icon,
        badge: "/favicon.ico",
        tag: "restaurant-notification",
        requireInteraction: true,
        silent: false,
      });
    } catch (e) {
      console.error("Desktop notification failed:", e);
    }
  }
}
