import React from "react";

export default function StarRating({ value = 0, onChange, size = "text-lg", readOnly = false }) {
  const stars = [1, 2, 3, 4, 5];

  return (
    <div className={`flex gap-0.5 ${size}`}>
      {stars.map((star) => (
        <span
          key={star}
          onClick={() => !readOnly && onChange && onChange(star)}
          className={`${
            star <= Math.round(value) ? "text-yellow-500" : "text-gray-300"
          } ${!readOnly ? "cursor-pointer" : ""}`}
        >
          ★
        </span>
      ))}
    </div>
  );
}
