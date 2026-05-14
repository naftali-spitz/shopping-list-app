"use client";

import { motion } from "framer-motion";

export function AnimatedBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden">
      <motion.div
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 9, repeat: Infinity }}
        className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/20 blur-3xl"
      />

      <motion.div
        animate={{ x: [0, -50, 0], y: [0, 20, 0] }}
        transition={{ duration: 11, repeat: Infinity }}
        className="absolute right-0 top-40 h-96 w-96 rounded-full bg-purple-500/20 blur-3xl"
      />

      <div className="absolute bottom-0 left-1/3 h-96 w-96 rounded-full bg-blue-500/20 blur-3xl" />
    </div>
  );
}
