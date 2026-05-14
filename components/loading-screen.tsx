"use client";

import { motion } from "framer-motion";
import { ShoppingCart } from "lucide-react";

export function LoadingScreen() {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[200] flex items-center justify-center bg-[#050816]"
    >
      <div className="relative flex flex-col items-center gap-6">
        <motion.div
          animate={{
            rotate: 360,
            scale: [1, 1.08, 1],
          }}
          transition={{
            rotate: {
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            },
            scale: {
              duration: 2,
              repeat: Infinity,
            },
          }}
          className="flex h-24 w-24 items-center justify-center rounded-[28px] border border-cyan-400/20 bg-cyan-400/10 backdrop-blur-xl"
        >
          <ShoppingCart className="h-10 w-10 text-cyan-300" />
        </motion.div>

        <div className="text-center">
          <h1 className="text-3xl font-bold text-white">FutureCart</h1>
          <p className="mt-2 text-sm text-white/50">
            Loading futuristic shopping experience...
          </p>
        </div>

        <div className="flex gap-2">
          {[0, 1, 2].map((dot) => (
            <motion.div
              key={dot}
              animate={{
                opacity: [0.3, 1, 0.3],
                y: [0, -6, 0],
              }}
              transition={{
                duration: 1,
                repeat: Infinity,
                delay: dot * 0.2,
              }}
              className="h-3 w-3 rounded-full bg-cyan-300"
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}
