interface PSRALogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  showText?: boolean;
  className?: string;
}

export default function PSRALogo({
  size = "md",
  showText = true,
  className = "",
}: PSRALogoProps) {
  const sizeClasses = {
    sm: { container: "w-16 h-16", text: "text-xs" },
    md: { container: "w-20 h-20", text: "text-sm" },
    lg: { container: "w-24 h-24", text: "text-base" },
    xl: { container: "w-32 h-32", text: "text-lg" },
  };

  const currentSize = sizeClasses[size];

  return (
    <div className={`flex items-center space-x-3 space-x-reverse ${className}`}>
      {/* شعار الجمعية - صورة */}
      <div className={`${currentSize.container} relative`}>
        <img
          src="./psra-logo.png"
          alt="شعار جمعية المحترفون للبحث والإنقاذ"
          className="w-full h-full object-contain"
          onError={(e) => {
            // جرب الصيغ البديلة
            const target = e.target as HTMLImageElement;
            const currentSrc = target.src;

            if (currentSrc.includes(".png")) {
              target.src = "./psra-logo.jpg";
            } else if (currentSrc.includes(".jpg")) {
              target.src = "./psra-logo.jpeg";
            } else if (currentSrc.includes(".jpeg")) {
              target.src = "./psra-logo.jfif";
            } else if (currentSrc.includes(".jfif")) {
              target.src = "./psra-logo.svg";
            } else {
              // في حالة عدم وجود أي صورة، اعرض شعار بديل
              target.style.display = "none";
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "block";
            }
          }}
        />
        {/* شعار بديل في حالة عدم وجود الصورة */}
        <div
          className="w-full h-full bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center shadow-lg border-2 border-white"
          style={{ display: "none" }}
        >
          <span className="text-white font-bold text-lg">PSRA</span>
        </div>
      </div>

      {/* النص */}
      {showText && (
        <div className="text-right">
          <div className="font-bold text-gray-900 text-lg">
            جمعية المحترفون للبحث والإنقاذ
          </div>
          <div className="text-sm text-gray-600">
            Professional Search & Rescue Association
          </div>
        </div>
      )}
    </div>
  );
}
