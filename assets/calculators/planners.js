/* Independently implemented public tools. Work records from the mobile apps are never accessed. */
(() => {
  'use strict';
  const node = typeof module !== 'undefined' && module.exports;
  const {fixed,ceiling,money,InputError} = node ? require('./math.js') : globalThis.ProCalculators;
  const zones = {
    'America/New_York':'New York / Eastern','America/Chicago':'Chicago / Central',
    'America/Denver':'Denver / Mountain','America/Phoenix':'Phoenix / Arizona',
    'America/Los_Angeles':'Los Angeles / Pacific','America/Anchorage':'Anchorage / Alaska',
    'Pacific/Honolulu':'Honolulu / Hawaii','America/Toronto':'Toronto / Eastern',
    'America/Halifax':'Halifax / Atlantic','America/St_Johns':'St. John’s / Newfoundland',
    'America/Winnipeg':'Winnipeg / Central','America/Regina':'Regina / Saskatchewan',
    'America/Edmonton':'Edmonton / Mountain','America/Vancouver':'Vancouver / Pacific',
    'America/Whitehorse':'Whitehorse / Yukon','America/Iqaluit':'Iqaluit / Eastern',
    'America/Yellowknife':'Yellowknife / Mountain'
  };
  function whole(input,key,label,max=999999) {
    const integer=Number(fixed(input[key],0,key,label));
    if (integer>max) throw new InputError(key,label+' must be '+max.toLocaleString('en-US')+' or less.');
    return integer;
  }
  const units = (value,one,many=one+'s') => value.toLocaleString('en-US')+' '+(value===1 || value===1n ? one : many);
  function market(input, currency='USD') {
    const fee=fixed(input.fee,2,'fee','Booth fee'), other=fixed(input.other,2,'other','Other fixed costs');
    const price=fixed(input.price,2,'price','Selling price per item'), cost=fixed(input.cost,2,'cost','Variable cost per item');
    const count=BigInt(whole(input,'units','Planned units sold'));
    const fixedCosts=fee+other, contribution=price-cost, revenue=price*count, net=contribution*count-fixedCosts;
    const target=fixedCosts===0n ? 0n : contribution>0n ? ceiling(fixedCosts,contribution) : null;
    const fmt=amount=>money(amount,currency);
    let formula;
    if(fixedCosts===0n) formula='Your fixed costs are zero, so you reach break-even before the first sale. Each unit then changes your result by '+fmt(contribution)+'.';
    else if(target===null) formula='At this price each sale contributes '+fmt(contribution)+' after variable costs. No quantity at this price will recover '+fmt(fixedCosts)+' in fixed costs.';
    else formula=fmt(fixedCosts)+' in fixed costs ÷ '+fmt(contribution)+' contributed by each sale = '+units(target,'whole unit')+' after rounding up.';
    return {primary:target===null?'Unreachable':units(target,'unit'),state:target===null || net<0n?'short':'ready',
      rows:{fixed:fmt(fixedCosts),contribution:fmt(contribution),revenue:fmt(revenue),net:fmt(net)},
      formula:formula+' With '+units(count,'planned sale')+', your result after costs is '+fmt(net)+'.'};
  }
  function lesson(input) {
    const opening=whole(input,'opening','Opening lesson credits'), added=whole(input,'added','New prepaid credits');
    const attended=whole(input,'attended','Attended lessons'), missed=whole(input,'missed','Missed lessons charged');
    const excused=whole(input,'excused','Excused lessons'), reversed=whole(input,'reversed','Reversed charges');
    const weekly=whole(input,'weekly','Lessons per week',35);
    if(!weekly)throw new InputError('weekly','Enter at least one lesson per week to estimate coverage.');
    if(reversed>attended+missed) throw new InputError('reversed','Reversed charges cannot exceed attended lessons plus charged misses in this period.');
    const used=attended+missed-reversed, balance=opening+added-used, usable=Math.max(0,balance);
    const weeks=Math.floor(usable/weekly), extra=usable%weekly;
    const coverage=units(weeks,'full week')+(extra?' + '+units(extra,'lesson'):'');
    return {primary:balance<0?units(-balance,'uncovered lesson'):units(balance,'credit'),state:balance<0?'short':'ready',
      rows:{available:units(opening+added,'credit'),used:units(used,'credit'),excused:units(excused,'lesson'),coverage},
      formula:opening+' opening + '+added+' prepaid − '+attended+' attended − '+missed+' charged misses + '+reversed+' reversed = '+balance+' credits. Each excused lesson leaves the balance unchanged.'};
  }
  function wallTime(value,zone,key,label) {
    const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(String(value));
    if(!match)throw new InputError(key,'Enter the local date and time for '+label+'.');
    const [year,month,day,hour,minute]=match.slice(1).map(Number);
    const naive=Date.UTC(year,month-1,day,hour,minute);
    if(year<2000 || year>2099 || new Date(naive).toISOString().slice(0,16)!==value)throw new InputError(key,'Choose a valid date from 2000 through 2099 and a valid local time.');
    const formatter=new Intl.DateTimeFormat('en-US',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    const wallEpoch=instant=>{
      const p=Object.fromEntries(formatter.formatToParts(instant).map(({type,value})=>[type,Number(value)]));
      return Date.UTC(p.year,p.month-1,p.day,p.hour,p.minute);
    };
    const offsets=new Set([-36,0,36].map(hours=>{
      const sample=naive+hours*3600000; return wallEpoch(sample)-sample;
    }));
    const possible=[...offsets].map(offset=>naive-offset).filter(candidate=>wallEpoch(candidate)===naive);
    if(!possible.length)throw new InputError(key,'This time is skipped when the property’s clock changes. Choose an existing local time.');
    if(possible.length>1)throw new InputError(key,'This time occurs twice when the property’s clock changes. Choose an unambiguous time before or after the change.');
    return possible[0];
  }
  function duration(minutes) {
    const hours=Math.floor(minutes/60), remainder=minutes%60;
    return hours ? hours+' hr'+(remainder?' '+remainder+' min':'') : remainder+' min';
  }
  function turnover(input) {
    if(!Object.hasOwn(zones,input.zone))throw new InputError('zone','Choose the property’s time zone.');
    const access=wallTime(input.access,input.zone,'access','property access');
    const deadline=wallTime(input.deadline,input.zone,'deadline','guest check-in');
    if(deadline<=access) throw new InputError('deadline','Guest check-in must be after property access. For an overnight turn, use the next date.');
    const bedrooms=whole(input,'bedrooms','Bedrooms',100), baths=whole(input,'baths','Bathrooms',100);
    const bedMin=whole(input,'bedMin','Minutes per bedroom',1440), bathMin=whole(input,'bathMin','Minutes per bathroom',1440);
    const common=whole(input,'common','Kitchen and shared spaces',1440), inspection=whole(input,'inspection','Restock and final inspection',1440);
    const buffer=whole(input,'buffer','Handoff buffer',1440);
    const work=bedrooms*bedMin+baths*bathMin+common+inspection;
    if(!work)throw new InputError('common','Enter at least one minute of cleaning or inspection work.');
    const latest=deadline-60000*(work+buffer), cleanBy=deadline-60000*buffer;
    const delta=(latest-access)/60000;
    const options={timeZone:input.zone,month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'};
    const date=instant=>new Intl.DateTimeFormat('en-US',options).format(instant);
    const clock=instant=>new Intl.DateTimeFormat('en-US',{timeZone:input.zone,hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(instant);
    return {primary:clock(latest),state:delta<0?'short':'ready',
      rows:{startDate:date(latest),cleanBy:date(cleanBy),deadline:date(deadline),work:duration(work),room:delta<0?'Short by '+duration(-delta):delta===0?'Exact fit':duration(delta)+' spare'},
      formula:bedrooms+' × '+bedMin+' min for bedrooms + '+baths+' × '+bathMin+' min for bathrooms + '+common+' min for shared spaces + '+inspection+' min for restocking and inspection = '+duration(work)+' of sequential work. Reserve another '+duration(buffer)+' before check-in.'};
  }
  const api={market,lesson,turnover,zones};
  if(node)module.exports=api;else globalThis.ProPlanners=api;
})();
