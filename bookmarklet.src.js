javascript:(function(){
  var nameEl=document.querySelector('[data-testid="User-Name"]');
  var author=nameEl?nameEl.innerText.split('\n')[0]:'Unknown';
  var timeEl=document.querySelector('time');
  var date=timeEl?timeEl.getAttribute('datetime').slice(0,10):'';
  var url=location.href;
  var titleEl=document.querySelector('[data-testid="twitter-article-title"]');
  var tweetEl=document.querySelector('[data-testid="tweetText"]');
  var title=titleEl?titleEl.innerText.trim():tweetEl?tweetEl.innerText.slice(0,100):document.title;
  var richView=document.querySelector('[data-testid="twitterArticleRichTextView"]');
  var readView=document.querySelector('[data-testid="twitterArticleReadView"]');
  var editorImgs=richView?Array.from(richView.querySelectorAll('img')):[];
  var allImgs=readView?Array.from(readView.querySelectorAll('img')):[];
  var headerImg=allImgs.find(function(img){return!editorImgs.includes(img)&&img.src.includes('pbs.twimg')&&!img.src.includes('profile_images')&&img.naturalWidth>200;});
  window._headerImg=headerImg?headerImg.src:null;
  var html='';
  function esc(t){return t.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  if(richView){
    var cd=(richView.querySelector('.DraftEditor-root')||{querySelector:function(){}}).querySelector('[data-contents="true"]');
    if(cd){
      var blocks=Array.from(cd.children);
      window._articleImgs={};
      blocks.forEach(function(b,i){
        if(b.querySelector('article'))return;
        var img=b.querySelector('img[src*="pbs.twimg"]');
        if(img&&img.naturalWidth>100)window._articleImgs[i]=img.src;
      });
      blocks.forEach(function(b,i){
        if(b.querySelector('article')){
          var card=b.querySelector('[data-testid="tweet"]');
          if(card){
            var cu=card.querySelector('[data-testid="User-Name"]');
            var cA=cu?cu.innerText.split('\n')[0]:'';
            var le=card.querySelector('a[href*="/status/"]');
            var cU='';
            if(le){
              var m=le.getAttribute('href').match(/^(\/[^\/]+\/status\/\d+)/);
              if(m)cU='https://x.com'+m[1];
            }
            var cov=card.querySelector('[data-testid="article-cover-image"]');
            var cT='',cD='';
            if(cov&&cov.nextElementSibling){
              var tc=cov.nextElementSibling;
              if(tc.children[0])cT=tc.children[0].innerText.trim();
              if(tc.children[1])cD=tc.children[1].innerText.trim();
            }else{
              var tt=card.querySelector('[data-testid="tweetText"]');
              cD=tt?tt.innerText.trim():'';
            }
            html+='<div class="card">';
            if(cT)html+='<p class="ct">'+(cU?'<a href="'+cU+'">'+esc(cT)+'</a>':esc(cT))+'</p>';
            if(cA)html+='<p class="cm">'+(!cT&&cU?'<a href="'+cU+'">'+esc(cA)+'</a>':esc(cA))+'</p>';
            if(cD)html+='<p class="cd">'+esc(cD).replace(/\n/g,'<br>')+'</p>';
            html+='</div>\n';
          }
          return;
        }
        var codeBlk=b.querySelector('[data-testid="markdown-code-block"]');
        if(codeBlk){
          var pre=codeBlk.querySelector('pre');
          var lng=codeBlk.querySelector('span');
          var lang=lng?lng.innerText.trim():'';
          var ct=pre?pre.textContent:codeBlk.innerText;
          if(lang)html+='<p class="codelang">'+esc(lang)+'</p>';
          html+='<pre class="code">'+esc(ct.replace(/\n+$/,''))+'</pre>\n';
          return;
        }
        var fc=b.firstElementChild;
        var tag=fc?fc.tagName:'';
        var t=b.innerText.trim();
        if(window._articleImgs[i]){
          html+='<figure><img src="'+window._articleImgs[i]+'"></figure>\n';
        }else if(tag==='H2'){
          html+='<h2>'+esc(t)+'</h2>\n';
        }else if(tag==='LI'){
          html+='<dl>\n';
          Array.from(b.querySelectorAll('li')).forEach(function(li){
            var lines=li.innerText.trim().split('\n');
            html+='<dt>'+esc(lines[0].trim())+'</dt><dd>'+esc(lines.slice(1).join(' ').trim())+'</dd>\n';
          });
          html+='</dl>\n';
        }else if(b.tagName==='BLOCKQUOTE'){
          html+='<blockquote>'+esc(t).replace(/\n/g,'<br>')+'</blockquote>\n';
        }else if(t){
          html+='<p>'+esc(t).replace(/\n/g,'<br>')+'</p>\n';
        }
      });
    }else{
      richView.innerText.split(/\n{2,}/).forEach(function(p){
        p=p.trim();
        if(!p||/^[\d.,KkMm]+$/.test(p)||/^@\w+(\s|$)/.test(p))return;
        html+='<p>'+esc(p).replace(/\n/g,'<br>')+'</p>\n';
      });
    }
  }else{
    var pc=document.querySelector('[data-testid="primaryColumn"]')||document;
    Array.from(pc.querySelectorAll('[data-testid="tweet"]')).slice(0,20).forEach(function(cell,i){
      var textEl=cell.querySelector('[data-testid="tweetText"]');
      var s=textEl?textEl.innerText.trim():'';
      if(!s)return;
      var userNameEl=cell.querySelector('[data-testid="User-Name"]');
      var ca=userNameEl?userNameEl.innerText.split('\n')[0]:'Unknown';
      if(i>0)html+='<hr>';
      html+='<p class="ca"><strong>'+esc(ca)+'</strong></p>\n<p>'+esc(s).replace(/\n/g,'<br>')+'</p>\n';
    });
  }
  var st=esc(title);
  var sa=esc(author);
  var heroHtml=window._headerImg?'<figure class="hero"><img src="'+window._headerImg+'"></figure>\n':'';
  var doc='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+sa+' - '+st+'</title><style>@media print{@page{margin:1in;}figure{break-inside:avoid;}}*{background:#fff!important;}body{font-family:Georgia,"Times New Roman",serif;max-width:740px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.8;font-size:17px;}h1{font-size:26px;line-height:1.3;margin-bottom:6px;}h2{font-size:19px;margin-top:32px;margin-bottom:4px;}p{margin:12px 0;}figure{margin:28px 0;break-inside:avoid;}figure img{max-width:100%;height:auto;display:block;margin:0 auto;border-radius:4px;}figure.hero{margin:-10px 0 32px 0;}figure.hero img{border-radius:6px;width:100%;}.ca{margin-bottom:0;color:#555;font-size:14px;font-family:Arial,sans-serif;}.meta{font-size:13px;color:#555;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid #ddd;}.meta a{color:#555;}dl{margin:16px 0;}dt{font-weight:bold;margin-top:14px;}dd{margin:4px 0 0 0;}hr{border:none;border-top:1px solid #ddd;margin:24px 0;}.card{border:1px solid #ddd;border-radius:6px;padding:12px 16px;margin:16px 0;break-inside:avoid;}.ct{font-weight:bold;font-size:16px;margin:0 0 3px 0;}.ct a{color:#1a1a1a;text-decoration:none;}.cm{font-size:13px;color:#555;font-family:Arial,sans-serif;margin:0 0 5px 0;}.cm a{color:#555;text-decoration:none;}.cd{font-size:14px;color:#333;margin:0;}blockquote{border-left:3px solid #ccc;margin:16px 0;padding:4px 0 4px 16px;color:#444;font-style:italic;}pre.code{background:#f6f8fa;border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:8px 0 16px 0;font-family:Menlo,Monaco,Consolas,"Courier New",monospace;font-size:12.5px;line-height:1.45;color:#1a1a1a;white-space:pre-wrap;word-break:break-word;}.codelang{font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin:16px 0 0 0;}</style></head><body>'+heroHtml+'<h1>'+st+'</h1><div class="meta"><strong>'+sa+'</strong> &middot; '+date+'<br><a href="'+url+'">'+url+'</a></div>'+html+'</body></html>';
  var origTitle=document.title;
  var fname=((title?author+' - '+title:author)||document.title)
    .replace(/[\\\/]/g,'-')
    .replace(/\|/g,'-')
    .replace(/\[/g,'(').replace(/\]/g,')')
    .replace(/[<>:*?"]/g,' ')
    .replace(/[#\^]/g,'')
    .replace(/\s+/g,' ')
    .replace(/^[.\s]+|[.\s]+$/g,'');
  var f=document.createElement('iframe');
  f.setAttribute('style','position:fixed;right:0;bottom:0;width:0;height:0;border:0;opacity:0;');
  document.body.appendChild(f);
  var fd=f.contentWindow.document;
  fd.open();fd.write(doc);fd.close();
  var done=false;
  function cleanup(){if(done)return;done=true;document.title=origTitle;if(f&&f.parentNode)f.parentNode.removeChild(f);}
  f.contentWindow.onafterprint=cleanup;
  setTimeout(function(){try{document.title=fname;f.contentWindow.focus();f.contentWindow.print();}catch(e){cleanup();}},700);
  setTimeout(cleanup,120000);
})();
