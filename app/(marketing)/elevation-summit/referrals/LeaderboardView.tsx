// The leaderboard's look, separate from the data so it can be previewed with sample data.
import { REFERRAL_GOAL, type PublicBoard, type PublicLeader } from '@/lib/summitReferralPublicTypes';
import JoinButtons from './JoinModal';

const initials = (name: string) => name.replace(/\./g, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const tone = ['', 'b', 'g'];

function Podium({ l, place }: { l: PublicLeader | undefined; place: 1 | 2 | 3 }) {
  if (!l) {
    return (
      <div className={`slb-pod p${place} empty`}>
        <div className="slb-avwrap"><span className="slb-medal">{place}</span><div className="slb-av ghost" aria-hidden>?</div></div>
        <p className="slb-pname">Your name here</p>
        <p className="slb-psub">Share your link to take this spot</p>
      </div>
    );
  }
  return (
    <div className={`slb-pod p${place}`}>
      <div className="slb-avwrap"><span className="slb-medal" aria-label={`Place ${l.rank}`}>{l.rank}</span><div className={`slb-av ${tone[place - 1]}`} aria-hidden>{initials(l.name)}</div></div>
      <p className="slb-pname">{l.name}</p>
      <p className="slb-pcount">{l.confirmed}</p>
      <p className="slb-psub">{l.reached ? 'Prize unlocked' : `${REFERRAL_GOAL - l.confirmed} to go`}</p>
    </div>
  );
}

export default function LeaderboardView({ board, days }: { board: PublicBoard | null; days: number }) {
  const leaders = board?.leaders ?? [];
  const rest = leaders.slice(3);

  return (
    <main className="slb">
      <section className="slb-hero">
        <div className="slb-hero-in">
          <p className="slb-eyebrow">
            <span>The Elevation Summit · 19 Nov 2026</span>
            <span className="slb-live"><i aria-hidden />LIVE</span>
          </p>
          <h1 className="slb-h1">Who’s bringing<br /><em>the most people?</em></h1>
          <span className="slb-bar" aria-hidden />
          <p className="slb-lede">Bring <b>{REFERRAL_GOAL} friends</b> to the Summit and win a prize. Every friend who registers with your link moves you up instantly.</p>
          <div className="slb-hero-cta"><JoinButtons variant="hero" /></div>
          {board && (
            <div className="slb-stats">
              <div className="slb-stat rust"><b>{board.totalConfirmed}</b><span>friends brought</span></div>
              <div className="slb-stat"><b>{board.referrers}</b><span>{board.referrers === 1 ? 'person referring' : 'people referring'}</span></div>
              <div className="slb-stat gold"><b>{days}</b><span>{days === 1 ? 'day to go' : 'days to go'}</span></div>
            </div>
          )}
        </div>
      </section>

      <div className="slb-wrap">
        {!board ? (
          <div className="slb-list" style={{ marginTop: 24, padding: 24, textAlign: 'center' }}><p style={{ margin: 0, color: 'var(--muted)' }}>The leaderboard is updating. Check back in a few minutes.</p></div>
        ) : (
          <>
            <div className="slb-podium" aria-label="Top three">
              <Podium l={leaders[1]} place={2} />
              <Podium l={leaders[0]} place={1} />
              <Podium l={leaders[2]} place={3} />
            </div>

            {rest.length > 0 && (
              <section className="slb-sec">
                <div className="slb-sech"><h2>The chase</h2><p>{board.reachedCount} reached {REFERRAL_GOAL}</p></div>
                <ol className="slb-list" start={4}>
                  {rest.map((l, i) => {
                    const pct = Math.min(100, Math.round((l.confirmed / REFERRAL_GOAL) * 100));
                    return (
                      <li key={`${l.rank}-${i}`} className="slb-row" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                        <span className="slb-rank">{l.rank}</span>
                        <span className={`slb-av ${tone[i % 3]}`} aria-hidden>{initials(l.name)}</span>
                        <div className="slb-mid">
                          <p className="slb-name">{l.name}</p>
                          <div className="slb-track" aria-hidden><div className={`slb-fill${l.reached ? ' done' : ''}`} style={{ width: `${pct}%` }} /></div>
                        </div>
                        <div className="slb-num">
                          <b>{l.confirmed}</b>
                          {l.reached ? <span className="slb-badge">Prize unlocked</span> : <span>{REFERRAL_GOAL - l.confirmed} to go</span>}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </section>
            )}
          </>
        )}

        <section className="slb-goal" aria-label="The goal">
          <div>
            <h3>Hit {REFERRAL_GOAL}. Win a prize.</h3>
            <p>Prizes are given at the Summit. Top referrers are celebrated on stage.</p>
          </div>
          <div className="slb-dots" aria-hidden>{Array.from({ length: REFERRAL_GOAL }, (_, i) => <i key={i} />)}</div>
        </section>

        <section className="slb-sec" aria-label="How it works">
          <div className="slb-sech"><h2>How it works</h2></div>
          <div className="slb-how">
            <div className="slb-step"><b>1</b><p><strong>Register free</strong>You get your own referral link straight away.</p></div>
            <div className="slb-step"><b>2</b><p><strong>Share it</strong>Send it to friends on WhatsApp, in class, anywhere.</p></div>
            <div className="slb-step"><b>3</b><p><strong>Watch it climb</strong>Each friend counts the moment they register.</p></div>
          </div>
        </section>

        <section className="slb-cta">
          <h3>Get on the board</h3>
          <p>Thursday 19 November · Lagos State University, Ojo · Free</p>
          <JoinButtons />
        </section>

        <p className="slb-fine">Names show as first name and last initial. The board updates every few minutes. Signups that look duplicated are checked before they count.</p>
      </div>
    </main>
  );
}
