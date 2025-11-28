export default function transliterateForDisplay(str) {
  if (!str) return '';

  // Try to recover common mojibake where UTF-8 bytes were interpreted as latin1
  try {
    // If original contains mainly latin1-range chars but no Cyrillic, attempt recovery
    const hasCyrillic = /[\u0400-\u04FF]/.test(str);
    const hasLatin1 = /[\u00C0-\u00FF]/.test(str);
    if (!hasCyrillic && hasLatin1) {
      const recovered = Buffer.from(str, 'latin1').toString('utf8');
      if (/[\u0400-\u04FF]/.test(recovered)) {
        str = recovered;
      }
    }
  } catch (e) {
    // ignore
  }

  const map = {
    'А':'A','Б':'B','В':'V','Г':'G','Д':'D','Е':'E','Ё':'E','Ж':'Zh','З':'Z','И':'I','Й':'Y','К':'K','Л':'L','М':'M','Н':'N','О':'O','П':'P','Р':'R','С':'S','Т':'T','У':'U','Ф':'F','Х':'Kh','Ц':'Ts','Ч':'Ch','Ш':'Sh','Щ':'Shch','Ъ':'','Ы':'Y','Ь':'','Э':'E','Ю':'Yu','Я':'Ya',
    'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'e','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya'
  };

  const transliterated = str.split('').map(c => map[c] || c).join('');
  // remove non-ascii by filtering char codes, normalize separators, collapse whitespace
  const asciiOnly = transliterated.split('').filter(ch => ch.charCodeAt(0) <= 127).join('');
  return asciiOnly.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
}
