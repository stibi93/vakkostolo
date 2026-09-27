import { expect,it } from 'vitest';
import { parseResults } from '../src/results/api';
import { alcoholScale } from '../src/results/scale';
const id='10000000-0000-0000-0000-000000000001';
const guesses={price:[0,0,0,0,0,1,0,0],alcohol:[{tenths:140,count:1}],liking:[0,0,0,0,0,0,0,1,0,0]};
const wine={id,position:1,name:'Felfedett bor',price_huf:5000,price_bucket:5,alcohol_tenths:135,photo_updated_at:null,response_count:1,average_liking:8,guesses,
  own:{price_bucket:6,price_huf:null,alcohol_tenths:140,liking:8,price_points:25,alcohol_points:41.6666666667,total:67}};
const answered={id,price_bucket:6,price_huf:null,price_points:25,alcohol_tenths:140,alcohol_points:41.6666666667,liking:8,questions:[]};
const raw={scoring_version:2,final:false,revealed_count:1,max_points:100,wines:[wine],
  leaderboard:[{id,nickname:'Anna',seat:1,rank:1,points:67,answered:1,unscored:0}],
  scorecards:[{id,wines:[answered]}]};
it('eredményadapter csak a saját összevetést és engedélyezett mezőket viszi tovább',()=>{
  const parsed=parseResults({...raw,hidden:'secret',wines:[{...wine,others:['secret'],own:{...wine.own,participant_id:'secret'}}]},'player');
  expect(parsed.wines[0].own).toMatchObject({priceBucket:6,pricePoints:25,total:67});
  expect(JSON.stringify(parsed)).not.toContain('secret');
  expect(()=>parseResults(raw,'host')).toThrow();
  expect(parseResults({...raw,wines:[{...wine,own:null}]},'host').wines[0].own).toBeNull();
});
it.each([
  {...raw,max_points:200},{...raw,scoring_version:'2'},
  {...raw,wines:[{...wine,photo_updated_at:'invalid'}]},
  {...raw,wines:[{...wine,average_liking:null}]},
  {...raw,wines:[{...wine,own:{...wine.own,total:101}}]},
  {...raw,wines:[{...wine,own:{...wine.own,price_points:-1}}]},
  {...raw,leaderboard:[{...raw.leaderboard[0],unscored:2}]},
  {...raw,wines:[{...wine,guesses:{...guesses,price:[1,1,0,0,0,0,0,0]}}]},
  {...raw,leaderboard:[raw.leaderboard[0],raw.leaderboard[0]]},
  {...raw,scorecards:[]},
])('hibás eredmény nem válhat kijelezhető állapottá (%#)',value=>expect(()=>parseResults(value,'player')).toThrow());
it('hiányzó tipp és tetszésátlag valódi null marad; üres eredmény megengedett',()=>{
  const blank={id,price_bucket:null,price_huf:null,price_points:null,alcohol_tenths:null,alcohol_points:null,liking:null,questions:[]};
  const missing=parseResults({...raw,scorecards:[{id,wines:[blank]}],wines:[{...wine,response_count:0,average_liking:null,own:null,guesses:{price:[0,0,0,0,0,0,0,0],alcohol:[],liking:[0,0,0,0,0,0,0,0,0,0]}}]},'player');
  expect(missing.wines[0].own).toBeNull();expect(missing.wines[0].averageLiking).toBeNull();
  expect(missing.scorecards[0].wines[0].priceBucket).toBeNull();
  expect(parseResults({...raw,revealed_count:0,max_points:0,wines:[],leaderboard:[],scorecards:[]},'player').wines).toEqual([]);
});
it('az alkoholskála a tippek és a valódi érték közötti üres lépéseket is tartalmazza',()=>{
  expect(alcoholScale([{tenths:130,count:1},{tenths:140,count:2}],135)).toEqual([
    {tenths:130,count:1},{tenths:135,count:0},{tenths:140,count:2},
  ]);
});
