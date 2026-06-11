async function debugGFG() {
  console.log('Connecting to browser...');
  let wsUrl = '';
  try {
    const res = await fetch('http://localhost:9222/json');
    const targets = await res.json();
    for (const t of targets) {
      if (t.type === 'page' && t.url && t.url.includes('geeksforgeeks.org/problems/')) {
        wsUrl = t.webSocketDebuggerUrl;
        break;
      }
    }
  } catch (e) {
    console.error('Failed to get targets:', e);
    return;
  }

  if (!wsUrl) {
    console.log('No GFG tab found.');
    return;
  }

  const ws = new WebSocket(wsUrl);
  
  ws.onopen = () => {
    // Inject the script
    const script = `
      (() => {
        const title = document.querySelector('h3')?.textContent || '';
        
        let diff = '';
        const spans = document.querySelectorAll('span, p, div');
        for (const s of spans) {
          const txt = (s.textContent || '').trim().toLowerCase();
          if (txt === 'easy' || txt === 'medium' || txt === 'hard' || txt === 'basic') {
            diff = txt;
            break;
          }
        }
        
        const hasAce = !!window.ace;
        let aceCode = '';
        if (hasAce) {
          const editorElement = document.querySelector('.ace_editor');
          if (editorElement) {
             aceCode = window.ace.edit(editorElement).getValue();
          }
        }
        
        // Find Description
        let descClass = '';
        const possibleDivs = document.querySelectorAll('div');
        for (const div of possibleDivs) {
          const text = div.textContent || '';
          if (text.includes('You are given an array') || text.length > 300) {
            // Check if this div is a good candidate for description
            if (div.className && typeof div.className === 'string' && div.className.includes('problem')) {
              descClass = div.className;
              break;
            }
          }
        }
        
        // Let's just collect all classes of divs that have text length > 200
        const largeDivs = Array.from(possibleDivs)
          .filter(d => (d.textContent||'').length > 200 && typeof d.className === 'string' && d.className.trim() !== '')
          .map(d => d.className);

        return JSON.stringify({
          title,
          diff,
          descClass,
          largeDivs: [...new Set(largeDivs)].slice(0, 15)
        });
      })();
    `;

    ws.send(JSON.stringify({
      id: 1,
      method: 'Runtime.evaluate',
      params: {
        expression: script,
        returnByValue: true
      }
    }));
  };

  ws.onmessage = (msg) => {
    const data = JSON.parse(msg.data);
    if (data.id === 1) {
      if (data.result && data.result.result && data.result.result.value) {
        console.log(JSON.parse(data.result.result.value));
      } else {
        console.dir(data, { depth: null });
      }
      ws.close();
    }
  };
}

debugGFG().catch(console.error);
