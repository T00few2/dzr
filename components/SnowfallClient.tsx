// components/SnowfallClient.tsx
"use client";

import React from "react";
import Snowfall from "react-snowfall";

const SnowfallClient = () => {
    return (
        <div
            style={{
                position: "fixed", // Ensures the snow effect stays fixed
                top: 0,
                left: 0,
                width: "100vw", // Full viewport width
                height: "100vh", // Full viewport height
                pointerEvents: "none", // Prevents interaction with the snow
                zIndex: -1, // Ensures it stays in the background
            }}
        >
            <Snowfall snowflakeCount={200} color="white" />
        </div>
    );
};

export default SnowfallClient;
