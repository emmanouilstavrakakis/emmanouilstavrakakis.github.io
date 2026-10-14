(function () {
  "use strict";
  const root=document.getElementById("math-notebook");
  if (!root || root.dataset.preview === "true") return;
  const q=selector=>root.querySelector(selector);
  const repository=root.dataset.repository;
  if(!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) return;
  root.dataset.discussionConnected="true";
  const github="https://github.com/"+repository;
  const prefix=/^\[Notebook:(gaussian-clouds|boolean-functions|theorems|general)\]\s*/i;
  const originValues=["Human","AI-assisted","AI-generated"];
  const paperNames={"gaussian-clouds":"Gaussian clouds","boolean-functions":"Boolean functions",theorems:"Appealing theorems",general:"General remarks"};
  let threads=[],page=0,total=0,loading=false,hasLoaded=false;

  function el(tag,className,text) {
    const node=document.createElement(tag);
    if(className) node.className=className;
    if(text!=null) node.textContent=String(text);
    return node;
  }
  function field(body,name) {
    const line=String(body||"").split("\n").find(line=>line.startsWith(name+": "));
    return line ? line.slice(name.length+2).trim() : "";
  }
  function origin(body) {
    const value=field(body,"Origin");
    return originValues.includes(value)?value:"Unspecified";
  }
  function issueUrl(number) {
    return github+"/issues/"+Number(number);
  }
  function link(url,text) {
    const a=el("a","",text);a.href=url;a.target="_blank";a.rel="noopener noreferrer";return a;
  }
  function dateText(value) {
    const date=new Date(value);
    if(!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("en",{year:"numeric",month:"short",day:"numeric",timeZone:"UTC"}).format(date);
  }
  async function readApi(url) {
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),12000);
    try {
      const response=await fetch(url,{
        headers:{Accept:"application/vnd.github+json"},
        credentials:"omit",signal:abort.signal
      });
      if(!response.ok) {
        if(response.status===403 || response.status===429) throw new Error("GitHub is limiting requests. Please try later or use the GitHub link.");
        if(response.status===404 || response.status===410 || response.status===422) throw new Error("Public discussion is not available here yet. Use the GitHub link below.");
        throw new Error("Discussion could not be loaded. You can still read and post on GitHub.");
      }
      return await response.json();
    } catch(error) {
      if(error.name==="AbortError") throw new Error("GitHub took too long to respond. Please try again or open the discussion on GitHub.");
      throw error;
    } finally {clearTimeout(timer);}
  }
  function metadata(item,declaredOrigin) {
    const user=item.user && item.user.login ? item.user.login : "GitHub contributor";
    return user+" · "+dateText(item.created_at)+" · Origin: "+declaredOrigin;
  }
  async function loadReplies(issue,holder) {
    if(!issue.comments) {holder.append(el("p","nb-small nb-muted","No replies yet. You can add the first reply on GitHub."));return;}
    const status=el("p","nb-status","Loading replies…");holder.append(status);
    try {
      const comments=await readApi("https://api.github.com/repos/"+repository+"/issues/"+Number(issue.number)+"/comments?per_page=100");
      if(!Array.isArray(comments)) throw new Error("Replies could not be loaded.");
      status.remove();
      comments.forEach(comment=>{
        const reply=el("article","nb-reply");
        reply.append(el("div","nb-small nb-muted",metadata(comment,origin(comment.body))));
        reply.append(el("p","",comment.body || "(No text)"));
        holder.append(reply);
      });
      if(issue.comments>comments.length) holder.append(el("p","nb-small nb-muted","Showing the first "+comments.length+" replies. Read the full thread on GitHub for more."));
    } catch(error) {
      status.textContent=error.message || "Replies could not be loaded. Open the thread on GitHub.";
    }
  }
  function renderThreads() {
    const holder=q("#nb-threads");holder.replaceChildren();
    const chosenPaper=q("#nb-filter-paper").value,chosenOrigin=q("#nb-filter-origin").value;
    const shown=threads.filter(issue=>{
      const match=String(issue.title||"").match(prefix);
      return match && (chosenPaper==="all"||match[1].toLowerCase()===chosenPaper) &&
        (chosenOrigin==="all"||origin(issue.body)===chosenOrigin);
    });
    if(hasLoaded && !shown.length) holder.append(el("p","nb-empty",threads.length?"No loaded contributions match these filters.":"No contributions have been published yet. You can write the first remark above."));
    shown.forEach(issue=>{
      const match=issue.title.match(prefix),paper=match[1].toLowerCase(),declaredOrigin=origin(issue.body);
      const article=el("article","nb-thread"),badges=el("div","nb-badges");
      [paperNames[paper],field(issue.body,"Type")||"Contribution",declaredOrigin,issue.state==="closed"?"Closed on GitHub":"Open discussion"].forEach(text=>badges.append(el("span","nb-badge",text)));
      article.append(badges);
      const heading=el("h3");heading.append(link(issueUrl(issue.number),issue.title.replace(prefix,"")));
      article.append(heading,el("p","nb-small nb-muted",metadata(issue,declaredOrigin)));
      const details=el("details"),summary=el("summary","","Read contribution · "+(Number(issue.comments)||0)+" replies");
      details.append(summary);
      let expanded=false;
      details.addEventListener("toggle",()=>{
        if(!details.open||expanded) return;
        expanded=true;
        details.append(el("div","nb-thread-body",issue.body||"(No text)"));
        const replies=el("div");details.append(replies);
        loadReplies(issue,replies);
      });
      article.append(details);
      const actions=el("p","nb-small");actions.style.marginTop="14px";
      actions.append(link(issueUrl(issue.number)+"#new_comment_field","Reply on GitHub ↗"));
      article.append(actions);holder.append(article);
    });
  }
  async function loadDiscussion(more) {
    if(loading) return;
    loading=true;
    q("#nb-load-discussion").disabled=true;
    q("#nb-more-discussion").disabled=true;
    q("#nb-discussion-status").textContent="Loading public mathematical remarks…";
    const targetPage=more?page+1:1;
    const query="repo:"+repository+" is:issue notebook in:title";
    const params=new URLSearchParams({q:query,sort:"updated",order:"desc",per_page:"30",page:String(targetPage)});
    try {
      const data=await readApi("https://api.github.com/search/issues?"+params.toString());
      if(!Array.isArray(data.items)) throw new Error("Discussion could not be loaded.");
      const candidates=data.items.filter(item=>!item.pull_request&&prefix.test(String(item.title||""))&&Number.isSafeInteger(item.number)&&item.number>0);
      const combined=more?threads.concat(candidates):candidates;
      threads=Array.from(new Map(combined.map(issue=>[issue.number,issue])).values());
      page=targetPage;total=Number(data.total_count)||0;hasLoaded=true;
      q("#nb-more-discussion").hidden=page*30>=Math.min(total,1000);
      q("#nb-load-discussion").textContent="Refresh";
      q("#nb-discussion-status").textContent=threads.length+" discussion thread"+(threads.length===1?"":"s")+" loaded. Review claims and their declared verification status.";
      if(data.incomplete_results) q("#nb-discussion-status").textContent+=" GitHub returned partial results; the full list is available on GitHub.";
      renderThreads();
    } catch(error) {
      q("#nb-discussion-status").textContent=error.message||"Discussion could not be loaded. Please use the GitHub link.";
    } finally {
      loading=false;q("#nb-load-discussion").disabled=false;q("#nb-more-discussion").disabled=false;
    }
  }
  root.addEventListener("notebook:load-discussion",event=>loadDiscussion(Boolean(event.detail&&event.detail.more)));
  root.addEventListener("notebook:filter-discussion",renderThreads);
})();
