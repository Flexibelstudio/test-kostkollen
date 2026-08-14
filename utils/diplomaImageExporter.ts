import { BootcampRankDef, BORJE_SIGNATURE_DARK, BORJE_SIGNATURE_LIGHT } from './bootcampUtils';

export const downloadDiplomaImage = async (
  rankDef: BootcampRankDef,
  userName: string,
  streakDays: number,
  promotionDate?: string
): Promise<void> => {
  const width = 1000;
  const height = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Kunde inte skapa canvas-kontext');
  }

  // Theme colors
  const isDark = rankDef.theme === 'dark';
  const isSand = rankDef.theme === 'sand';

  const bgColor = isDark ? '#56524D' : isSand ? '#F1EAE0' : '#FAF6EF';
  const textColor = isDark ? '#FAF6EF' : '#56524D';
  const mutedColor = isDark ? '#FAF6EF' : '#7A756E';
  const accentColor = '#D96E4A';
  const boxBg = isDark ? '#3D3935' : isSand ? '#FAF6EF' : '#FFFFFF';
  const borderColor = isDark ? '#D96E4A' : isSand ? '#D96E4A' : '#56524D';

  // 1. Draw Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, width, height);

  // 2. Outer & Inner Border
  ctx.lineWidth = 6;
  ctx.strokeStyle = borderColor;
  ctx.strokeRect(30, 30, width - 60, height - 60);

  ctx.lineWidth = 2;
  ctx.strokeStyle = isSand ? '#D96E4A' : borderColor;
  ctx.strokeRect(45, 45, width - 90, height - 90);

  // 3. Header Text
  ctx.textAlign = 'center';
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 18px Jost, sans-serif';
  ctx.fillText('• GENERALENS BOOTCAMP •', width / 2, 95);

  ctx.fillStyle = mutedColor;
  ctx.font = 'bold 16px Jost, sans-serif';
  ctx.fillText('BEFORDRINGSBEVIS', width / 2, 125);

  // Helper to load image safely
  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  // 4. Draw Badge
  const badgeImg = await loadImage(rankDef.badgePath);
  const badgeY = 160;
  const badgeSize = 140;

  if (badgeImg) {
    ctx.drawImage(badgeImg, width / 2 - badgeSize / 2, badgeY, badgeSize, badgeSize);
  } else {
    // Fallback badge
    ctx.beginPath();
    ctx.arc(width / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = boxBg;
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = accentColor;
    ctx.stroke();

    ctx.fillStyle = accentColor;
    ctx.font = 'bold 48px serif';
    ctx.fillText('🎖️', width / 2, badgeY + badgeSize / 2 + 16);
  }

  // 5. Titles & User Name
  let currentY = badgeY + badgeSize + 50;

  ctx.fillStyle = mutedColor;
  ctx.font = '20px Jost, sans-serif';
  ctx.fillText('Härmed befordras', width / 2, currentY);

  currentY += 45;
  ctx.fillStyle = textColor;
  ctx.font = 'bold 36px Fraunces, serif';
  ctx.fillText(userName || 'Soldat', width / 2, currentY);

  currentY += 35;
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 20px Jost, sans-serif';
  ctx.fillText('TILL', width / 2, currentY);

  currentY += 60;
  ctx.fillStyle = textColor;
  ctx.font = 'bold 56px Fraunces, serif';
  ctx.fillText(rankDef.name.toUpperCase(), width / 2, currentY);

  // 6. Achievement Badge Pill
  currentY += 40;
  const bragdText = `🎖️ Bragd: ${rankDef.req === 0 ? 'Mönstrad i truppen' : `${streakDays} dagar i följd`}`;
  ctx.font = 'bold 18px Jost, sans-serif';
  const bragdWidth = ctx.measureText(bragdText).width + 40;

  ctx.fillStyle = boxBg;
  ctx.beginPath();
  ctx.roundRect(width / 2 - bragdWidth / 2, currentY - 24, bragdWidth, 38, 19);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = accentColor;
  ctx.stroke();

  ctx.fillStyle = accentColor;
  ctx.fillText(bragdText, width / 2, currentY);

  // 7. Quote Box
  currentY += 60;
  const quoteBoxWidth = width - 160;
  const quoteBoxX = 80;
  const quoteText = `"${rankDef.quote}"`;

  // Measure and wrap quote text
  ctx.font = 'italic 22px Jost, sans-serif';
  const words = quoteText.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > quoteBoxWidth - 60) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 32;
  const quoteBoxHeight = lines.length * lineHeight + 60;

  // Draw Quote Box background
  ctx.fillStyle = boxBg;
  ctx.beginPath();
  ctx.roundRect(quoteBoxX, currentY, quoteBoxWidth, quoteBoxHeight, 16);
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = `${borderColor}40`;
  ctx.stroke();

  // Quote Box Label
  ctx.fillStyle = accentColor;
  ctx.font = 'bold 14px Jost, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('BÖRJES ORDER & VITSORD', quoteBoxX + 24, currentY + 28);

  // Draw Quote Lines
  ctx.fillStyle = textColor;
  ctx.font = 'italic 21px Jost, sans-serif';
  lines.forEach((line, index) => {
    ctx.fillText(line, quoteBoxX + 24, currentY + 62 + index * lineHeight);
  });

  // 8. Footer Section
  currentY += quoteBoxHeight + 50;

  // Date on the left
  ctx.textAlign = 'left';
  ctx.fillStyle = mutedColor;
  ctx.font = '16px Jost, sans-serif';
  ctx.fillText('Datum för befordran', 80, currentY);

  const formattedDate = promotionDate 
    ? promotionDate 
    : new Date().toLocaleDateString('sv-SE', { year: 'numeric', month: 'long', day: 'numeric' });
  ctx.fillStyle = textColor;
  ctx.font = 'bold 20px Jost, sans-serif';
  ctx.fillText(formattedDate, 80, currentY + 30);

  // Signature on the right
  const sigSrc = isDark ? BORJE_SIGNATURE_LIGHT : BORJE_SIGNATURE_DARK;
  const sigImg = await loadImage(sigSrc);
  ctx.textAlign = 'right';

  if (sigImg) {
    ctx.drawImage(sigImg, width - 260, currentY - 20, 180, 50);
  }

  ctx.fillStyle = mutedColor;
  ctx.font = 'bold 16px Jost, sans-serif';
  ctx.fillText('General Börje, Högkvarteret', width - 80, currentY + 45);

  // 9. Download Trigger
  const dataUrl = canvas.toDataURL('image/png');
  const a = document.createElement('a');
  const cleanUserName = (userName || 'Soldat').replace(/[^a-zA-Z0-9åäöÅÄÖ_-]/g, '_');
  a.download = `Diplom_${rankDef.name}_${cleanUserName}.png`;
  a.href = dataUrl;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
};
