javascript:(function(){
  var IS_EXT=false;
  var isX=/(^|\.)(x\.com|twitter\.com)$/.test(location.hostname);
  var url=location.href;
  function esc(t){return String(t==null?'':t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
  function para(t){return esc(t).replace(/\n/g,'<br>');}
  function meta(sel){var m=document.querySelector(sel);return m?(m.getAttribute('content')||'').trim():'';}
  /* Text of a node, with X's emoji <img alt="X"> mapped back to the character
     and <br> kept. innerText drops those emoji and inserts a hard break around
     inline links, which is what put "@coinbase" on a line of its own. */
  function inlineText(el){
    if(!el)return '';
    var out='';
    (function walk(n){
      for(var i=0;i<n.childNodes.length;i++){
        var c=n.childNodes[i];
        if(c.nodeType===3){out+=c.nodeValue;}
        else if(c.nodeType===1){
          if(c.tagName==='IMG'){out+=(c.getAttribute('alt')||'');}
          else if(c.tagName==='BR'){out+='\n';}
          else{walk(c);}
        }
      }
    })(el);
    return out.replace(/[ \t]+/g,' ').replace(/ *\n */g,'\n').replace(/\n{3,}/g,'\n\n').trim();
  }
  /* Inline markup the source used, kept rather than flattened to plain text:
     a page's bold, italics, code and links are most of what makes the print
     look like the page. Text nodes are escaped and only these tags are
     emitted, so nothing from the page can inject markup. */
  var KEEP={B:'strong',STRONG:'strong',I:'em',EM:'em',CODE:'code',SUP:'sup',SUB:'sub',S:'s',DEL:'s',MARK:'mark',U:'u'};
  function rich(el){
    if(!el)return '';
    var out='';
    (function walk(n){
      for(var i=0;i<n.childNodes.length;i++){
        var c=n.childNodes[i];
        if(c.nodeType===3){out+=esc(c.nodeValue);continue;}
        if(c.nodeType!==1)continue;
        var t=c.tagName;
        if(t==='IMG'){out+=esc(c.getAttribute('alt')||'');continue;}
        if(t==='BR'){out+='<br>';continue;}
        if(t==='A'){
          var href='';
          try{href=new URL(c.getAttribute('href')||'',location.href).toString();}catch(e){href='';}
          if(href){out+='<a href="'+esc(href)+'">';walk(c);out+='</a>';}
          else walk(c);
          continue;
        }
        if(KEEP[t]){out+='<'+KEEP[t]+'>';walk(c);out+='</'+KEEP[t]+'>';continue;}
        walk(c);
      }
    })(el);
    return out.replace(/\s+/g,' ').trim();
  }
  /* Rendered src, upgraded to the print-worthy variant and size-filtered.
     naturalWidth is the real size, which beats the declared width/height a
     lazy-loading page puts in the markup. */
  /* Substack (and other Cloudinary-style CDNs) serve
     /image/fetch/<transforms>/<url-encoded original>. og:image is a 1200x675
     c_fill crop of it, so the header image printed cropped. The original is
     right there in the URL. */
  function unwrapCdn(u){
    var m=(u||'').match(/\/image\/fetch\/[^/]*\/(https?%3A%2F%2F.+)$/i);
    if(m){try{return decodeURIComponent(m[1]);}catch(e){}}
    return u;
  }
  function imgSrc(el,min,dims){
    if(!el)return '';
    var s=el.currentSrc||el.src||'';
    if(!s||s.indexOf('data:')===0)return '';
    /* naturalWidth first (the truth), then the same image on the live page.
       NOT the declared width: a lazy image below the fold has not loaded and
       often declares a placeholder size, and dropping those loses real
       pictures. The header search applies a declared-size check of its own,
       where the cost of a wrong guess is one icon instead of one photo. */
    var w=el.naturalWidth||(dims?dims[s.split('?')[0]]:0)||0;
    if(w&&w<(min||200))return '';
    return unwrapCdn(s).replace(/name=[a-z0-9]+/,'name=large').replace(/_(normal|bigger|mini|x96|200x200)\./,'_400x400.');
  }
  function avatarOf(scope){
    var a=(scope||document).querySelector('[data-testid="Tweet-User-Avatar"] img[src*="profile_images"]')
      ||(scope||document).querySelector('img[src*="profile_images"]');
    return a?(a.currentSrc||a.src).replace(/_(normal|bigger|mini|x96|200x200)\./,'_400x400.'):'';
  }

  /* ---- X tweets and threads ------------------------------------------- */

  /* Quoted tweets carry data-testid="tweet" too, so every per-cell query has
     to stop at a nested one or the quote's text renders twice. */
  function own(cell,sel){
    var all=cell.querySelectorAll(sel),out=[],i,p;
    for(i=0;i<all.length;i++){
      p=all[i].parentElement;
      while(p&&p!==cell&&!(p.getAttribute&&p.getAttribute('data-testid')==='tweet'))p=p.parentElement;
      if(p===cell)out.push(all[i]);
    }
    return out;
  }
  function userOf(cell){
    var un=cell.querySelector('[data-testid="User-Name"]'),name='',handle='',i,t;
    if(un){
      var ns=un.querySelector('span');
      name=ns?inlineText(ns):'';
      var sp=un.querySelectorAll('span,div');
      for(i=0;i<sp.length;i++){
        t=(sp[i].textContent||'').trim();
        if(/^@[A-Za-z0-9_]{1,15}$/.test(t)){handle=t;break;}
      }
    }
    if(!handle){
      var av=cell.querySelector('[data-testid^="UserAvatar-Container-"]');
      if(av){
        var h=av.getAttribute('data-testid').replace('UserAvatar-Container-','');
        if(h&&h!=='unknown')handle='@'+h;
      }
    }
    /* The display name and the handle sit in separate elements; innerText on
       the whole block glues them into "Kalshi@Kalshi". */
    if(handle&&name===handle.slice(1))name=handle.slice(1);
    var tm=cell.querySelector('a[href*="/status/"] time')||cell.querySelector('time');
    var link=tm&&tm.parentElement&&tm.parentElement.getAttribute?(tm.parentElement.getAttribute('href')||''):'';
    if(link.charAt(0)==='/')link='https://x.com'+link;
    return {name:name||(handle?handle.slice(1):'Unknown'),handle:handle,
            date:tm?(tm.getAttribute('datetime')||'').slice(0,10):'',link:link};
  }
  function tweetBody(cell){
    var h='',seen={};
    own(cell,'[data-testid="tweetText"]').forEach(function(tx){
      inlineText(tx).split(/\n{2,}/).forEach(function(p){
        p=p.trim();
        if(p)h+='<p>'+para(p)+'</p>\n';
      });
    });
    own(cell,'[data-testid="tweetPhoto"] img').forEach(function(im){
      var u=imgSrc(im,120);
      if(!u)return;
      var k=u.split('?')[0];
      if(seen[k])return;
      seen[k]=1;
      h+='<figure><img src="'+u+'"></figure>\n';
    });
    /* A quoted tweet renders as a card, the same shape the article path uses
       for an embedded tweet. */
    var q=cell.querySelector('[data-testid="tweet"]');
    if(q){
      var qu=userOf(q),qt=(q.querySelector('[data-testid="tweetText"]')?inlineText(q.querySelector('[data-testid="tweetText"]')):'');
      if(qt||qu.handle){
        h+='<div class="card">';
        h+='<p class="cm">'+(qu.link?'<a href="'+qu.link+'">':'')+esc(qu.name)+(qu.handle?' '+esc(qu.handle):'')+(qu.link?'</a>':'')+'</p>';
        if(qt)h+='<p class="cd">'+para(qt)+'</p>';
        h+='</div>\n';
      }
    }
    return h;
  }
  /* X's own <title> is '(3) name on X: "the tweet" / X'. Unwrap it, or a
     tweet with no text of its own prints that furniture as its heading. */
  function xDocTitle(){
    var t=(document.title||'').replace(/^\(\d+\)\s*/,'').replace(/\s*[\/|]\s*X\s*$/,'').trim();
    var m=t.match(/^.*? on X:\s*"([\s\S]*)"$/);
    return (m?m[1]:t).trim();
  }
  function tweetTitle(s){
    s=(s||'').replace(/\s+/g,' ').trim();
    if(!s)return xDocTitle();
    var m=s.match(/^(.{20,110}?)[.!?\u2026](?:\s|$)/);
    var t=m?m[1]:s;
    if(t.length>110){
      t=t.slice(0,110);
      var sp=t.lastIndexOf(' ');
      if(sp>40)t=t.slice(0,sp);
      t+='\u2026';
    }
    return t;
  }
  function renderTweets(){
    var pc=document.querySelector('[data-testid="primaryColumn"]')||document;
    var cells=[];
    Array.prototype.forEach.call(pc.querySelectorAll('[data-testid="tweet"]'),function(c){
      var p=c.parentElement;
      while(p){
        if(p.getAttribute&&p.getAttribute('data-testid')==='tweet')return;
        p=p.parentElement;
      }
      /* Promoted tweets sit in the conversation as if they were replies.
         placementTracking is the wrapper X puts around an ad slot. */
      if(c.closest('[data-testid="placementTracking"]'))return;
      cells.push(c);
    });
    if(!cells.length)return null;
    var root=cells[0],ru=userOf(root);
    var rootText=(own(root,'[data-testid="tweetText"]')[0]?inlineText(own(root,'[data-testid="tweetText"]')[0]):'');
    var body=tweetBody(root),i,u,reps=[],cont=true;
    for(i=1;i<cells.length;i++){
      u=userOf(cells[i]);
      /* The author's own consecutive tweets are the thread: they read as one
         piece, so they continue the body instead of opening a reply block.
         Once someone else speaks, the thread is over. */
      if(cont&&ru.handle&&u.handle===ru.handle){body+=tweetBody(cells[i]);continue;}
      cont=false;
      reps.push({u:u,cell:cells[i]});
    }
    if(reps.length){
      body+='<h2 class="rh">Replies</h2>\n';
      reps.slice(0,60).forEach(function(r){
        var b=tweetBody(r.cell);
        if(!b)return;
        var av=avatarOf(r.cell);
        body+='<div class="reply"><div class="rhead">'
          +(av?'<img src="'+av+'">':'')
          +'<span class="rn">'+esc(r.u.name)+'</span>'
          +(r.u.handle?'<span class="rx">'+esc(r.u.handle)+'</span>':'')
          +(r.u.date?'<span class="rx">&middot; '+r.u.date+'</span>':'')
          +'</div>'+b+'</div>\n';
      });
      if(reps.length>60)body+='<p class="rx">'+(reps.length-60)+' further replies not printed.</p>\n';
    }
    return {title:tweetTitle(rootText),author:ru.name,handle:ru.handle,date:ru.date,
            avatar:avatarOf(root),hero:'',html:body};
  }

  /* ---- Any other site: reader-mode extraction -------------------------- */
  /* Ported from claude-chrome-bridge (extension/offscreen.js): the same root
     pick, title order and boilerplate filter it uses to capture articles. It
     runs against the live DOM here rather than fetched HTML, so lazy images
     have resolved and naturalWidth is real. */

  var SKIP='script,style,noscript,svg,form,nav,footer,header,aside,iframe,figcaption,.ad,.advertisement';
  var BOILERPLATE=['advertisement','sign up for','cookie policy','privacy policy',
                   'all rights reserved','subscribe to','your browser is'];
  function pickRoot(){
    var explicit=document.querySelector('article, main, [role=main]');
    if(explicit&&explicit.textContent.trim().length>400)return explicit;
    var best=null,bestScore=0,els=document.querySelectorAll('div, section'),i,el,links,score;
    for(i=0;i<els.length;i++){
      el=els[i];
      if(el.querySelectorAll(':scope > p').length<3)continue;
      links=el.querySelectorAll('a').length;
      /* Penalise link-dense blocks: those are nav and "related stories" rails. */
      score=(el.textContent||'').length/(1+links*40);
      if(score>bestScore){bestScore=score;best=el;}
    }
    return best||document.body;
  }
  /* "Prediction market - Wikipedia" is what og:title actually says, and that
     suffix ends up in the print filename. Drop a trailing separator plus the
     site's own name when the page tells us what that is. */
  function trimSite(t,site){
    if(!t||!site)return t;
    var r=new RegExp('\\s*[-|\u2013\u2014\u00b7:]\\s*'+site.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'\\s*$','i');
    return t.replace(r,'').trim()||t;
  }
  function renderWeb(){
    var host=location.hostname.replace(/^www\./,'');
    var label=host.split('.').slice(-2)[0]||'';
    var title=meta('meta[property="og:title"]')||meta('meta[name="og:title"]');
    if(!title){var h1=document.querySelector('h1');title=h1?h1.textContent.trim():'';}
    if(!title)title=(document.title||'').trim();
    var site=meta('meta[property="og:site_name"]')||host||'Article';
    title=trimSite(trimSite(title,meta('meta[property="og:site_name"]')),label);
    var author=meta('meta[name="author"]')||meta('meta[property="article:author"]')||meta('meta[name="twitter:creator"]')||'';
    if(!author||/^https?:/.test(author))author=site;
    var date=(meta('meta[property="article:published_time"]')||meta('meta[name="date"]')||meta('meta[itemprop="datePublished"]')).slice(0,10);
    if(!date){var tm=document.querySelector('time[datetime]');if(tm)date=(tm.getAttribute('datetime')||'').slice(0,10);}
    /* Reading mode. Chrome's own is a side panel with no extension API to
       trigger it or read its output, so the equivalent is Mozilla's
       Readability, the engine behind Firefox Reader View, vendored in
       extension/vendor. It gets a CLONE because it mutates the document it is
       handed. Falls back to the local root pick when it is absent (the
       bookmarklet has no vendor file) or when it bails on a short page. */
    var art=null;
    if(typeof Readability!=='undefined'){
      try{art=new Readability(document.cloneNode(true),{charThreshold:250}).parse();}catch(e){art=null;}
    }
    var root,html='',seen={},seenImg={},inList=false;
    if(art&&art.content){
      root=document.createElement('div');
      root.innerHTML=art.content;
      if(art.byline&&(!author||author===site))author=art.byline.replace(/^by\s+/i,'').trim();
      if(!title&&art.title)title=art.title;
    }else{
      root=pickRoot();
    }
    /* Readability hands back a detached fragment, whose images have no
       naturalWidth to filter on. The live page has the same images, loaded. */
    var liveDims={};
    Array.prototype.forEach.call(document.images,function(li){
      var k=(li.currentSrc||li.src||'').split('?')[0];
      if(k&&li.naturalWidth)liveDims[k]=Math.max(liveDims[k]||0,li.naturalWidth);
    });
    /* The header image, found in the LIVE DOM rather than in the extracted
       content: reader mode drops it (it is outside the prose), and the first
       image of the extracted content is a body image, not the header, so
       promoting that one put the wrong picture at the top.
       Only an element that actually sits above the lede counts, which is what
       keeps a header off posts that have none. og:image is not a substitute:
       it exists on nearly every article as a social card. */
    var hero='';
    (function(){
      var scope=document.querySelector('article, main, [role=main]')||document.body;
      /* Where the prose starts, which is NOT simply the first <p>: the byline,
         the dateline and the dek are short paragraphs that sit above the
         header image, and anchoring to them ruled the header out. */
      var bodyStart=scope.querySelector('[class*="article-body" i],[class*="articlebody" i],[itemprop="articleBody"]');
      if(!bodyStart){
        var ps=scope.querySelectorAll('p');
        for(var j=0;j<ps.length;j++){
          if((ps[j].textContent||'').trim().length>80){bodyStart=ps[j];break;}
        }
      }
      var nodes=scope.querySelectorAll('img,[data-img-url],[data-src],[style*="background-image"]');
      for(var i=0;i<nodes.length;i++){
        var n=nodes[i],u='';
        if(bodyStart&&!(bodyStart.compareDocumentPosition(n)&Node.DOCUMENT_POSITION_PRECEDING))return;
        /* Not the full SKIP list: a header image usually lives inside
           <header>, so skipping <header> here threw away the thing we came
           for. */
        if(n.closest('script,style,noscript,form,iframe,footer,nav'))continue;
        if(n.tagName==='IMG'){
          u=imgSrc(n,400,liveDims);
          var dw=parseInt(n.getAttribute('width')||'0',10),dh=parseInt(n.getAttribute('height')||'0',10);
          if((dw&&dw<400)||(dh&&dh<250))u='';
        }
        else{
          /* XDA carries the header on a wrapper div as data-img-url, with no
             <img> until its lazy loader runs. */
          u=n.getAttribute('data-img-url')||n.getAttribute('data-src')||'';
          if(!u){
            var bg=(n.getAttribute('style')||'').match(/url\((['"]?)(.*?)\1\)/);
            u=bg?bg[2]:'';
          }
          if(u){try{u=new URL(u,location.href).toString();}catch(e){u='';}}
        }
        if(!u)continue;
        if(/logo|sprite|\bicon\b|avatar|author|pfp|placeholder|1x1|spacer/i.test(u))continue;
        /* An icon, not a photograph. */
        if(/\.svg(\?|#|$)/i.test(u))continue;
        hero=unwrapCdn(u);
        seenImg[hero.split('?')[0].split('#')[0]]=1;
        return;
      }
    })();
    var dek=meta('meta[property="og:description"]')||meta('meta[name="description"]');
    /* Author avatar. Nothing standardises this, but two signals are common
       enough to cover most publishers: an image inside a byline/author
       container, and an alt that names the author or says "avatar". Prefer a
       hit that names the author, so a "more from this site" rail can't win.
       The CDN URL is unwrapped because the page embeds a 36px crop and the
       byline prints it at 46. */
    var avatar='',cands=[],ci,im,src,w;
    Array.prototype.push.apply(cands,document.querySelectorAll('[class*="byline" i] img, [class*="author" i] img, [itemprop="author"] img, [rel="author"] img, img[alt*="avatar" i], img[alt*="profile picture" i]'));
    for(var pass=0;pass<2&&!avatar;pass++){
      for(ci=0;ci<cands.length;ci++){
        im=cands[ci];
        if(im.closest(SKIP))continue;
        if(pass===0&&!(author&&(im.getAttribute('alt')||'').toLowerCase().indexOf(author.toLowerCase())>=0))continue;
        src=im.currentSrc||im.src||'';
        if(!src||src.indexOf('data:')===0)continue;
        w=im.naturalWidth||0;
        if(w&&(w<24||w>1200))continue;
        avatar=unwrapCdn(src);
        break;
      }
    }
    /* The >40-character floor is what keeps nav and promo text out when the
       root pick had to fall back to <body>. Inside a confidently-picked
       article container it does the opposite, dropping one-line paragraphs,
       pull quotes and sign-offs. */
    var minLen=(root===document.body)?40:10,started=false;
    /* Reader mode keeps the author bio because it sits inside the article
       container, and once extracted it reads like an opening paragraph. Which
       container it came from is the giveaway, and that is context Readability
       throws away, so collect it from the live DOM first. */
    var furniture=[];
    Array.prototype.forEach.call(
      document.querySelectorAll('[class*="author" i],[class*="byline" i],[class*="bio" i],[class*="excerpt" i],[id*="author" i],[data-nosnippet]'),
      function(c){
        /* The bio is as often a SIBLING of the author element as a child of
           it, so index one level up as well. */
        [c,c.parentElement].forEach(function(scope){
          if(!scope)return;
          var t=(scope.textContent||'').replace(/\s+/g,' ').trim();
          if(t&&t.length<2000&&furniture.indexOf(t)<0)furniture.push(t);
        });
      });
    /* Containment, not equality: XDA puts both bio sentences in one
       <div class="with-excerpt"> separated by <br>, and reader mode hands them
       back as separate paragraphs, so neither matches the container's text. */
    function isFurniture(t){
      if(t.length>1200)return false;
      for(var i=0;i<furniture.length;i++)if(furniture[i].indexOf(t)>=0)return true;
      return false;
    }
    Array.prototype.forEach.call(root.querySelectorAll('p, h1, h2, h3, h4, li, blockquote, pre, img'),function(el){
      if(el.closest(SKIP))return;
      if(el.tagName==='IMG'){
        var u=imgSrc(el,150,liveDims);
        if(!u)return;
        var k=u.split('?')[0].split('#')[0];
        if(seenImg[k])return;
        seenImg[k]=1;
        if(inList){html+='</ul>\n';inList=false;}
        var fig=el.closest('figure'),cap=fig?fig.querySelector('figcaption'):null;
        html+='<figure><img src="'+u+'">'+(cap&&cap.textContent.trim()?'<figcaption>'+rich(cap)+'</figcaption>':'')+'</figure>\n';
        return;
      }
      var tag=el.tagName.toLowerCase();
      var txt=(el.textContent||'').replace(/\s+/g,' ').trim();
      if(!txt)return;
      var low=txt.toLowerCase(),i;
      for(i=0;i<BOILERPLATE.length;i++)if(low.indexOf(BOILERPLATE[i])>=0)return;
      if(txt.length<=minLen&&!/^h[1-4]$/.test(tag))return;
      if(seen[txt])return;
      /* Byline furniture that reader mode keeps because it sits inside the
         article container: the dateline, the read-time, and the author bio.
         All of it is either already in the byline above or noise, and it only
         counts as furniture before the story has started. */
      if(!started&&tag==='p'){
        if(/^(published|updated|posted|last updated)\b[\s:]/i.test(txt))return;
        if(/^\d+\s*(min|minute)s?\s+read\b/i.test(txt))return;
        if(/^(by|share|follow)\b/i.test(txt)&&txt.length<120)return;
        if(isFurniture(txt))return;
        /* Belt for a bio the container scan missed: an opening paragraph that
           names the author and describes them in the third person. */
        if(author&&txt.indexOf(author.split(' ')[0])>=0
           &&/\b(writing|writer|covers|covering|editor|journalist|contributor|reporter|based in|joined|has been)\b/i.test(txt))return;
      }
      if(tag!=='li')started=true;
      seen[txt]=1;
      if(tag!=='li'&&inList){html+='</ul>\n';inList=false;}
      /* The subtitle sits in the markup as a heading but reads as a standfirst,
         and printing it as a section heading is what made every post open with
         a stray h2. */
      if(/^h[1-4]$/.test(tag)&&dek&&txt===dek.replace(/\s+/g,' ').trim()){html+='<p>'+rich(el)+'</p>\n';}
      else if(/^h[1-4]$/.test(tag)){html+='<h2>'+rich(el)+'</h2>\n';}
      else if(tag==='li'){if(!inList){html+='<ul>\n';inList=true;}html+='<li>'+rich(el)+'</li>\n';}
      else if(tag==='blockquote'){html+='<blockquote>'+rich(el)+'</blockquote>\n';}
      else if(tag==='pre'){html+='<pre class="code">'+esc(el.textContent.replace(/\n+$/,''))+'</pre>\n';}
      else{html+='<p>'+rich(el)+'</p>\n';}
    });
    if(inList)html+='</ul>\n';
    /* The story's own h1/h2 usually repeats the title, which would print twice
       under the <h1> below. */
    html=html.replace(new RegExp('^<h2>'+title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'</h2>\\n'),'');
    return {title:title,author:author,handle:'',date:date,avatar:avatar,hero:hero,html:html};
  }

  /* ---- X long-form article (unchanged) --------------------------------- */

  var nameEl=document.querySelector('[data-testid="User-Name"]');
  var author=nameEl?nameEl.innerText.split('\n')[0]:'Unknown';
  var timeEl=document.querySelector('time');
  var date=timeEl?timeEl.getAttribute('datetime').slice(0,10):'';
  var avatar='';
  if(IS_EXT){
    var pcol=document.querySelector('[data-testid="primaryColumn"]')||document;
    var av=pcol.querySelector('[data-testid="Tweet-User-Avatar"] img[src*="profile_images"]');
    if(!av&&nameEl){
      var an=nameEl;
      for(var ai=0;ai<6&&an&&!av;ai++){an=an.parentElement;if(an)av=an.querySelector('img[src*="profile_images"]');}
    }
    if(!av)av=pcol.querySelector('img[src*="profile_images"]');
    if(av)avatar=av.src.replace(/_(normal|bigger|mini|x96|200x200)\./,'_400x400.');
  }
  var titleEl=document.querySelector('[data-testid="twitter-article-title"]');
  var tweetEl=document.querySelector('[data-testid="tweetText"]');
  var title=titleEl?titleEl.innerText.trim():tweetEl?tweetEl.innerText.slice(0,100):document.title;
  var richView=document.querySelector('[data-testid="twitterArticleRichTextView"]');
  var readView=document.querySelector('[data-testid="twitterArticleReadView"]');
  var editorImgs=richView?Array.from(richView.querySelectorAll('img')):[];
  var allImgs=readView?Array.from(readView.querySelectorAll('img')):[];
  var headerImg=allImgs.find(function(img){return!editorImgs.includes(img)&&img.src.includes('pbs.twimg')&&!img.src.includes('profile_images')&&img.naturalWidth>200;});
  window._headerImg=headerImg?headerImg.src:null;
  var handle='';
  var html='';
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
    /* Not a long-form article: a status page (tweet or thread), or, in the
       extension, any other site. */
    var r=isX?renderTweets():(IS_EXT?renderWeb():renderTweets());
    if(r){
      title=r.title;author=r.author;handle=r.handle;date=r.date||date;html=r.html;
      if(r.avatar)avatar=r.avatar;
      if(!IS_EXT)avatar='';
      window._headerImg=r.hero||null;
    }
  }
  var st=esc(title);
  var sa=esc(author);
  var heroHtml=window._headerImg?'<figure class="hero"><img src="'+window._headerImg+'"></figure>\n':'';
  var byline='<strong>'+sa+'</strong>'+(handle?' <span class="mh">'+esc(handle)+'</span>':'')+(date?' &middot; '+date:'');
  var metaInner=byline+'<br><a href="'+url+'">'+url+'</a>';
  var metaHtml=avatar
    ?'<div class="meta withpic"><img class="avatar" src="'+avatar+'"><div>'+metaInner+'</div></div>'
    :'<div class="meta">'+metaInner+'</div>';
  var doc='<!DOCTYPE html><html><head><meta charset="UTF-8"><title>'+sa+' - '+st+'</title><style>@media print{@page{margin:1in;}figure{break-inside:avoid;}}*{background:#fff!important;}body{font-family:Georgia,"Times New Roman",serif;max-width:740px;margin:0 auto;padding:40px 20px;color:#1a1a1a;line-height:1.8;font-size:17px;}h1{font-size:26px;line-height:1.3;margin-bottom:6px;}h2{font-size:19px;margin-top:32px;margin-bottom:4px;break-after:avoid;}figcaption{font-family:Arial,sans-serif;font-size:12.5px;line-height:1.5;color:#777;text-align:center;margin-top:8px;}p,li{orphans:3;widows:3;}p{margin:12px 0;}ul{margin:12px 0 12px 20px;padding:0;}li{margin:6px 0;}figure{margin:28px 0;break-inside:avoid;}figure img{max-width:100%;max-height:15cm;height:auto;display:block;margin:0 auto;border-radius:4px;}figure.hero{margin:-10px 0 32px 0;}figure.hero img{border-radius:6px;width:100%;}.ca{margin-bottom:0;color:#555;font-size:14px;font-family:Arial,sans-serif;}.meta{font-size:13px;color:#555;margin-bottom:28px;padding-bottom:14px;border-bottom:1px solid #ddd;}.meta a{color:#555;}.meta.withpic{display:flex;align-items:center;gap:12px;}.meta img.avatar{width:46px;height:46px;border-radius:50%;flex:none;margin:0;}.mh{font-weight:normal;color:#777;}h2.rh{font-family:Arial,sans-serif;font-size:13px;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-top:40px;padding-top:14px;border-top:1px solid #ddd;}.reply{margin:0 0 6px 0;padding:14px 0 2px 0;break-inside:avoid;}.rhead{display:flex;align-items:center;gap:7px;font-family:Arial,sans-serif;font-size:12.5px;color:#777;margin-bottom:-4px;}.rhead img{width:24px;height:24px;border-radius:50%;flex:none;}.rn{font-weight:bold;color:#1a1a1a;}.rx{color:#888;font-family:Arial,sans-serif;font-size:12.5px;}.reply p{margin:8px 0;font-size:16px;}.reply figure{margin:14px 0;}.reply figure img{max-height:9cm;}dl{margin:16px 0;}dt{font-weight:bold;margin-top:14px;}dd{margin:4px 0 0 0;}hr{border:none;border-top:1px solid #ddd;margin:24px 0;}.card{border:1px solid #ddd;border-radius:6px;padding:12px 16px;margin:16px 0;break-inside:avoid;}.ct{font-weight:bold;font-size:16px;margin:0 0 3px 0;}.ct a{color:#1a1a1a;text-decoration:none;}.cm{font-size:13px;color:#555;font-family:Arial,sans-serif;margin:0 0 5px 0;}.cm a{color:#555;text-decoration:none;}.cd{font-size:14px;color:#333;margin:0;}blockquote{border-left:3px solid #ccc;margin:16px 0;padding:4px 0 4px 16px;color:#444;font-style:italic;}pre.code{background:#f6f8fa;border:1px solid #ddd;border-radius:6px;padding:12px 14px;margin:8px 0 16px 0;font-family:Menlo,Monaco,Consolas,"Courier New",monospace;font-size:12.5px;line-height:1.45;color:#1a1a1a;white-space:pre-wrap;word-break:break-word;}.codelang{font-family:Arial,sans-serif;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#888;margin:16px 0 0 0;}</style></head><body>'+heroHtml+'<h1>'+st+'</h1>'+metaHtml+html+'</body></html>';
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
  var fired=false;
  function go(){
    if(fired)return;
    fired=true;
    try{document.title=fname;f.contentWindow.focus();f.contentWindow.print();}catch(e){cleanup();}
  }
  /* Print once the images have decoded, not on a fixed delay. The old 700ms
     was enough on X, where every image is already cached from the page you
     are looking at, but a hero taken from og:image is a URL the browser has
     never fetched, so it printed as an empty box. */
  setTimeout(function(){
    var imgs=fd.images||[],pending=0,i;
    function done(){if(--pending<=0)setTimeout(go,120);}
    for(i=0;i<imgs.length;i++){
      if(imgs[i].complete)continue;
      pending++;
      imgs[i].addEventListener('load',done);
      imgs[i].addEventListener('error',done);
    }
    if(!pending)go();
  },400);
  /* One dead image must not hold the dialog hostage. */
  setTimeout(go,8000);
  setTimeout(cleanup,120000);
})();
