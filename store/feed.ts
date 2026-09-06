import { CardDecorator } from '../src/content/card-decorator';
import { DEFAULT_SETTINGS } from '../src/shared/constants';
const videos = [
  {id:'demoVideo01',title:'A calmer workspace, one change at a time',word:'Make room\nfor focus.',category:'WORKSPACE',color:'#315d52',duration:'12:40',watched:false},
  {id:'demoVideo02',title:'The small habits that make a difference',word:'Small habits.\nBig difference.',category:'EVERYDAY',color:'#746750',duration:'08:26',watched:true},
  {id:'demoVideo03',title:'Learning something new this weekend',word:'Stay\ncurious.',category:'LEARNING',color:'#405571',duration:'18:05',watched:false},
  {id:'demoVideo04',title:'A simple guide to getting started',word:'Start\nsomewhere.',category:'CREATIVE',color:'#8c614b',duration:'10:12',watched:true},
  {id:'demoVideo05',title:'Ideas worth making time for',word:'Follow\nthe idea.',category:'INSPIRATION',color:'#575372',duration:'15:48',watched:false},
  {id:'demoVideo06',title:'Finding a rhythm that works for you',word:'Find your\nown rhythm.',category:'EVERYDAY',color:'#476856',duration:'09:32',watched:true}
];
const decorator=new CardDecorator(()=>{});
for(const video of videos){
  const element=document.createElement('article');element.className='video-card';
  const thumbnail=document.createElement('a');thumbnail.className='thumb';thumbnail.href='#';
  const content=document.createElement('div');content.className='thumb-content';content.style.setProperty('--tile',video.color);
  const category=document.createElement('span');category.textContent=video.category;
  const heading=document.createElement('strong');heading.textContent=video.word;heading.style.whiteSpace='pre-line';
  content.append(category,heading);thumbnail.append(content);
  const duration=document.createElement('span');duration.className='duration';duration.textContent=video.duration;thumbnail.append(duration);
  const title=document.createElement('h2');title.textContent=video.title;
  const meta=document.createElement('p');meta.textContent='Sample video · Demonstration content';
  element.append(thumbnail,title,meta);document.getElementById('cards')!.append(element);
  decorator.apply({element,thumbnail,videoId:video.id,title:video.title,shorts:false},video.watched,undefined,{...DEFAULT_SETTINGS,showWatchedDate:false});
}
