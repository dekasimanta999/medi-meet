type StrengthLevel = "empty" | "weak" | "fair" | "good" | "strong";

interface PasswordStrengthIndicatorProps {
  password: string;
}

function getStrength(password: string): {
  level: StrengthLevel;
  score: number;
  suggestions: string[];
} {
  if (!password) return { level: "empty", score: 0, suggestions: [] };

  let score = 0;
  const suggestions: string[] = [];

  if (password.length >= 8) score++;
  else suggestions.push("At least 8 characters");

  if (/[A-Z]/.test(password)) score++;
  else suggestions.push("Add uppercase letter (A-Z)");

  if (/[a-z]/.test(password)) score++;
  else suggestions.push("Add lowercase letter (a-z)");

  if (/[0-9]/.test(password)) score++;
  else suggestions.push("Add a number (0-9)");

  if (/[^A-Za-z0-9]/.test(password)) score++;
  else suggestions.push("Add a special character (!@#$...)");

  const levels: StrengthLevel[] = ["weak", "weak", "fair", "good", "strong"];
  return { level: levels[score - 1] ?? "weak", score, suggestions };
}

export function PasswordStrengthIndicator({ password }: PasswordStrengthIndicatorProps) {
  const { level, score, suggestions } = getStrength(password);

  if (!password) return null;

  const bars = [1, 2, 3, 4, 5];

  const colorMap: Record<StrengthLevel, string> = {
    empty: "",
    weak: "bg-red-500",
    fair: "bg-orange-400",
    good: "bg-yellow-400",
    strong: "bg-green-500",
  };

  const labelMap: Record<StrengthLevel, string> = {
    empty: "",
    weak: "Weak",
    fair: "Fair",
    good: "Good",
    strong: "Strong",
  };

  const color = colorMap[level];

  return (
    <div className="space-y-2 mt-1">
      {/* Strength bars */}
      <div className="flex gap-1">
        {bars.map((bar) => (
          <div
            key={bar}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              bar <= score ? color : "bg-gray-200"
            }`}
          />
        ))}
      </div>

      {/* Label */}
      <p className={`text-xs font-medium ${
        level === "weak" ? "text-red-500" :
        level === "fair" ? "text-orange-400" :
        level === "good" ? "text-yellow-500" :
        "text-green-600"
      }`}>
        Password strength: {labelMap[level]}
      </p>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <ul className="space-y-0.5">
          {suggestions.map((s) => (
            <li key={s} className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-gray-300 inline-block" />
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}