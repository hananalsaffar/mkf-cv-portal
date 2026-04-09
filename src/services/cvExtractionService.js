const { PDFParse } = require("pdf-parse");

// Read text from PDF
async function extractPdfText(fileBuffer) {
  const parser = new PDFParse({ data: fileBuffer });
  const result = await parser.getText();
  return result.text || "";
}

// Clean text before extraction
function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

// Keep title case simple
function toTitleCase(text) {
  return text
    .toLowerCase()
    .replace(/\b\w/g, function (char) {
      return char.toUpperCase();
    })
    .trim();
}

// Collapse names like J U L I A N A
function collapseSpacedLetters(text) {
  return text.replace(/\b(?:[A-Z]\s+){2,}[A-Z]\b/g, function (match) {
    return match.replace(/\s+/g, "");
  });
}

// Remove duplicate skills
function uniqueSkills(skills) {
  const seen = new Set();

  return skills.filter(function (skill) {
    const cleanSkill = skill.trim();
    const key = cleanSkill.toLowerCase();

    if (!cleanSkill || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

// Clean one skill item
function cleanSkill(skill) {
  return skill
    .replace(/^[-•·▪◦]\s*/, "")
    .replace(/[.;,:]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// Check if a line looks like a section heading
function isHeadingLike(text) {
  return /^(profile|summary|contact|education|experience|work experience|skills|languages|reference|certificates|projects)$/i.test(
    text.trim()
  );
}

// Keep fallback simple and general
function extractWithFallback(text) {
  const lines = text
    .split("\n")
    .map(function (line) {
      return collapseSpacedLetters(line.trim());
    })
    .filter(Boolean);

  let fullName = "";
  let major = "";
  let graduationYear = "";
  let skills = [];

  for (let i = 0; i < Math.min(lines.length, 15); i++) {
    const line = lines[i];

    if (isHeadingLike(line)) {
      continue;
    }

    if (
      /^[A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3}$/.test(line) &&
      !/education|experience|skills|profile|contact|summary|reference|university|college|school/i.test(
        line
      )
    ) {
      fullName = line;
      break;
    }

    const leadNameMatch = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\b/);
    if (leadNameMatch) {
      fullName = leadNameMatch[1];
      break;
    }
  }

  const majorMatch =
    text.match(/major in\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/bachelor of\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/bsc in\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/b\.sc in\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/bs in\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/master(?:s)? in\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/foundation in\s+([A-Za-z&/(),.\-\s]{3,80})(?=\.|\n|final|gpa)/i) ||
    text.match(/information and communications technology\s*\(([^)]+)\)/i);

  if (majorMatch && majorMatch[1]) {
    major = toTitleCase(majorMatch[1].trim());
  }

  const expectedYearMatch = text.match(/expected to graduate\s+(20\d{2})/i);
  if (expectedYearMatch) {
    graduationYear = expectedYearMatch[1];
  } else {
    const yearMatches = text.match(/\b20\d{2}\b/g) || [];
    const validYears = yearMatches
      .map(Number)
      .filter(function (year) {
        return year >= 2015 && year <= 2035;
      });

    if (validYears.length > 0) {
      graduationYear = String(Math.max(...validYears));
    }
  }

  const skillsSectionMatch = text.match(
    /(?:skills|key skills|personal skills|programming skills|cybersecurity skills|tools\s*&\s*technologies|tools and technologies)\s*([\s\S]{0,1000})/i
  );

  if (skillsSectionMatch && skillsSectionMatch[1]) {
    skills = skillsSectionMatch[1]
      .split(/\n|,|•|·|\//)
      .map(cleanSkill)
      .filter(function (item) {
        return (
          item &&
          item.length >= 2 &&
          item.length <= 50 &&
          !/experience|education|profile|contact|summary|languages|reference|project/i.test(
            item
          )
        );
      });
  }

  return {
    full_name: fullName,
    major,
    graduation_year: graduationYear,
    skills: uniqueSkills(skills).slice(0, 20)
  };
}

// Clean final values before sending them back
function sanitizeExtractedDetails(details) {
  const safeDetails = {
    full_name: "",
    major: "",
    graduation_year: "",
    skills: ""
  };

  if (details.full_name && typeof details.full_name === "string") {
    let name = collapseSpacedLetters(details.full_name.trim());

    if (
      /^[A-Z\s]+$/.test(name) &&
      name.split(/\s+/).length >= 2 &&
      name.split(/\s+/).length <= 4
    ) {
      name = toTitleCase(name);
    }

    if (
      name.length >= 4 &&
      name.length <= 60 &&
      !/education|experience|skills|profile|contact|summary|reference|university|college|school/i.test(
        name
      )
    ) {
      safeDetails.full_name = name;
    }
  }

  if (details.major && typeof details.major === "string") {
    safeDetails.major = details.major.trim().slice(0, 100);
  }

  if (details.graduation_year) {
    const year = String(details.graduation_year).match(/\b20\d{2}\b/);
    if (year) {
      safeDetails.graduation_year = year[0];
    }
  }

  let skillItems = [];

  if (Array.isArray(details.skills)) {
    skillItems = details.skills;
  } else if (typeof details.skills === "string") {
    skillItems = details.skills.split(",");
  }

  safeDetails.skills = uniqueSkills(
    skillItems
      .map(function (skill) {
        return collapseSpacedLetters(cleanSkill(skill));
      })
      .filter(function (skill) {
        return (
          skill &&
          skill.length >= 2 &&
          skill.length <= 50 &&
          !/education|experience|profile|contact|summary|reference|languages|project/i.test(
            skill
          )
        );
      })
  ).join(", ");

  return safeDetails;
}

// Extract with LLM
async function extractWithLLM(text) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is missing");
  }

  if (!model) {
    throw new Error("OPENAI_MODEL is missing");
  }

  const trimmedText = collapseSpacedLetters(text).slice(0, 12000);

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You extract structured graduate CV details for an admin review form. Return only real values found in the CV. Do not guess. If unclear, return an empty string. Skills must be short skill names only."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                `Extract these fields from the CV text:\n` +
                `- full_name\n` +
                `- major\n` +
                `- graduation_year\n` +
                `- skills\n\n` +
                `Rules:\n` +
                `- full_name should be the candidate name only\n` +
                `- major should be the study field only\n` +
                `- graduation_year must be a 4-digit year if found\n` +
                `- skills must be an array of short skill names\n` +
                `- ignore headings like PROFILE, CONTACT, REFERENCE, SUMMARY\n` +
                `- ignore job responsibilities, long sentences, and decorative text\n` +
                `- do not guess if not clear\n\n` +
                `CV text:\n${trimmedText}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "graduate_cv_extraction",
          schema: {
            type: "object",
            additionalProperties: false,
            properties: {
              full_name: { type: "string" },
              major: { type: "string" },
              graduation_year: { type: "string" },
              skills: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["full_name", "major", "graduation_year", "skills"]
          }
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM extraction failed: ${errorText}`);
  }

  const result = await response.json();

  let jsonText = "";

  if (result.output_text) {
    jsonText = result.output_text;
  } else if (result.output && Array.isArray(result.output)) {
    const message = result.output.find(function (item) {
      return item.type === "message";
    });

    if (message && Array.isArray(message.content)) {
      const textBlock = message.content.find(function (contentItem) {
        return contentItem.type === "output_text";
      });

      if (textBlock && textBlock.text) {
        jsonText = textBlock.text;
      }
    }
  }

  if (!jsonText) {
    console.error("FULL LLM RESPONSE:", result);
    throw new Error("LLM extraction returned no output");
  }

  return JSON.parse(jsonText);
}

// Main extraction flow
async function extractGraduateDetailsFromText(rawText) {
  const text = normalizeText(rawText);

  if (!text) {
    throw new Error("No readable text was found in this PDF");
  }

  try {
    const llmResult = await extractWithLLM(text);

    return {
      extracted: sanitizeExtractedDetails(llmResult),
      source: "llm"
    };
  } catch (error) {
    console.error("LLM extraction failed, using fallback:", error.message);

    const fallbackResult = extractWithFallback(text);

    return {
      extracted: sanitizeExtractedDetails(fallbackResult),
      source: "fallback"
    };
  }
}

module.exports = {
  extractPdfText,
  extractGraduateDetailsFromText
};