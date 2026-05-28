"use client";

import Image from "next/image";
import { motion } from "framer-motion";

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
            rotate: [0, -4, 4, 0],
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 2.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="relative flex h-28 w-28 items-center justify-center rounded-[32px] border border-cyan-400/20 bg-cyan-400/10 shadow-[0_0_40px_rgba(34,211,238,0.28)] backdrop-blur-xl"
        >
          <Image
            src="/futurecart-icon.svg"
            alt="FutureCart"
            fill
            priority
            className="rounded-[32px] object-cover"
          />
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
