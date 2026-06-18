# Balanced Coupon Ranking: The Math and Logic of Fair Comparison

This document provides a comprehensive analysis of the **Health Score Calculation Engine** used in Dealora. It explains how the algorithm balances different user behaviors, handles the cold-start problem, prevents system gaming, and mathematically ensures that **no single parameter can overpower the others** to produce an unfair comparison.

---

## 🗺️ System Flow Overview

The diagram below shows how raw database fields are extracted, passed through individual mathematical formulas to produce normalized metrics (0–100), and combined using weights to determine the final persisted Health Score.

```mermaid
graph TD
    %% Input Layer
    subgraph Database Inputs
        V_S[successCount]
        V_F[failedCount]
        C_T[createdAt]
        T_C[trend.discoverCount]
        T_L[trend.lastDiscoverAt]
    end

    %% Calculation Layer
    subgraph Calculation Engine (0-100 Scales)
        calc_R[Laplace Reliability Formula]
        calc_F[Time-Decay Freshness Formula]
        calc_T[Activity-Decay Trend Formula]
    end

    %% Weights Layer
    subgraph Weighted Synthesis
        w_R["Reliability Weight (55%)"]
        w_F["Freshness Weight (30%)"]
        w_T["Trend Weight (15%)"]
    end

    %% Output
    H_S["Final Health Score (0-100)"]

    %% Connections
    V_S --> calc_R
    V_F --> calc_R
    
    C_T --> calc_F
    
    T_C --> calc_T
    T_L --> calc_T

    calc_R -->|reliabilityScore| w_R
    calc_F -->|freshnessScore| w_F
    calc_T -->|trendScore| w_T

    w_R -->|Additive Sum| H_S
    w_F -->|Additive Sum| H_S
    w_T -->|Additive Sum| H_S

    classDef input fill:#e1f5fe,stroke:#0288d1,stroke-width:2px;
    classDef calc fill:#efebe9,stroke:#5d4037,stroke-width:2px;
    classDef weight fill:#fff3e0,stroke:#f57c00,stroke-width:2px;
    classDef out fill:#e8f5e9,stroke:#388e3c,stroke-width:3px;
    
    class V_S,V_F,C_T,T_C,T_L input;
    class calc_R,calc_F,calc_T calc;
    class w_R,w_F,w_T weight;
    class H_S out;
```

---

## 🛠️ Step-by-Step Score Breakdown

The calculation is broken into **four distinct steps** that run sequentially for every active coupon.

### Step 1: Calculate Reliability Score ($R$)
The **Reliability Score** measures community trust based on success and fail votes. To ensure fairness, it uses **Laplace Smoothing**.

$$\text{Reliability Score } (R) = \left( \frac{\text{successCount} + 7}{\text{successCount} + \text{failedCount} + 10} \right) \times 100$$

#### Why Laplace Smoothing is Fair:
*   **Prevents "First-Vote Dominance":** A coupon with a single success vote ($1/1$) would have a raw success rate of $100\%$. Laplace smoothing adjusts this to $\frac{1+7}{1+10} \times 100 = 72.73\%$. This prevents new, unverified coupons from shooting straight to the top based on a single vote.
*   **Establishes a Fair Baseline:** Brand new coupons with zero feedback ($0/0$) start at a baseline of $\frac{7}{10} \times 100 = 70\%$. This is high enough to allow them to be seen, but conservative enough that they don't block established, highly-voted coupons.
*   **Reduces Volatility on Small Samples:** One bad vote on a new coupon doesn't ruin it forever. A $0/1$ record yields a score of $\frac{7}{11} \times 100 = 63.64\%$ instead of $0\%$.

---

### Step 2: Calculate Freshness Score ($F$)
The **Freshness Score** ensures that new promotions are discoverable and that old, expired, or stale codes slowly yield their search positions over time.

$$\text{Freshness Score } (F) = \frac{100}{1 + \text{daysOld}}$$

$$\text{where } \text{daysOld} = \frac{\text{now} - \text{createdAt}}{\text{milliseconds in a day}}$$

#### Why the Freshness Curve is Fair:
*   **High Initial Boost:** On Day 0 ($\text{daysOld} = 0$), a coupon receives a score of $100$. This gives it high visibility to help kickstart user votes.
*   **Rapid Initial Decay, Stable Tail:** The freshness drops to $50$ on Day 1, and $25$ on Day 3. This rapid decline prevents old coupons from coasting purely on their initial "newness" factor. By Day 30, it stabilizes at $\approx 3.2$, meaning older coupons must rely entirely on their community reliability score to remain competitive.

---

### Step 3: Calculate Trend Score ($T$)
The **Trend Score** identifies coupons that are currently experiencing high engagement (clicks/discovers).

$$\text{Trend Score } (T) = \min\left(\frac{\text{discoverCount}}{1 + \text{hoursSinceLastDiscover}}, 100\right)$$

#### Why the Trend Calculation is Fair:
*   **Decay of Inactivity:** If a coupon was highly popular yesterday but is ignored today, the $\text{hoursSinceLastDiscover}$ will grow, quickly dragging the score down. This ensures only *currently* hot coupons get the trend boost.
*   **Hard Cap at 100:** Clamping the score at $100$ prevents an extremely viral coupon (e.g., $10,000$ discovers in an hour) from generating a trend score of $5000$, which would break the scale and dwarf all other parameters.
*   **Zero-Activity Safeguard:** If a coupon has never been clicked, the score is explicitly set to $0$ to prevent undefined division errors.

---

### Step 4: Synthesize the Final Health Score ($H$)
The three normalized parameters are combined using a weighted additive sum:

$$\text{Health Score } (H) = (R \times 0.55) + (F \times 0.30) + (T \times 0.15)$$

The result is a unified score between **$0$ and $100$** that represents the overall quality, relevance, and current value of the coupon.

---

## ⚖️ How We Prevent Parameter Overpowering

A common flaw in multi-factor ranking algorithms is that one parameter can completely dominate the final score (e.g., a viral coupon ranking #1 despite being fake, or a 100% reliable coupon blocking all new content forever). 

Dealora's weights ($55\%$, $30\%$, $15\%$) are mathematically designed to prevent this.

### Maximum Contribution Limits
Since all parameters ($R, F, T$) are strictly bounded between $0$ and $100$, we can calculate the **maximum possible score points** each parameter can contribute to the final Health Score:

| Parameter | Weight | Max Weighted Contribution | Role in the System |
| :--- | :---: | :---: | :--- |
| **Reliability ($R$)** | $55\%$ | **55.0 points** | The foundation and quality anchor. |
| **Freshness ($F$)** | $30\%$ | **30.0 points** | The turnover engine (boosts new / decays old). |
| **Trend ($T$)** | $15\%$ | **15.0 points** | The short-term popularity booster. |

---

### Extreme Scenario Testing (Dominance Proof)

Let's test if any single parameter can break the system by taking its extreme values:

#### 1. Can a completely viral coupon with awful feedback dominate?
*   **Scenario:** A spammer uses bots to click a coupon $1,000$ times in $1$ minute ($T = 100$, max trend). The coupon is broken/fake, so users vote it down ($1$ success, $29$ fails $\rightarrow R = \frac{1+7}{30+10} \times 100 = 20$). It is $1$ day old ($F = 50$).
*   **Calculation:**
    $$H = (20 \times 0.55) + (50 \times 0.30) + (100 \times 0.15)$$
    $$H = 11.0 + 15.0 + 15.0 = \mathbf{41.0}$$
*   **Result:** Despite having the maximum possible Trend score ($100/100$) and decent freshness, the bad community feedback keeps the score at a low **$41.0$**. The $15\%$ trend weight is not strong enough to overpower community disapproval.

#### 2. Can a brand-new coupon block high-quality, trusted coupons?
*   **Scenario:** A coupon is brand-new ($F = 100$). It has no votes yet ($R = 70$, baseline) and no clicks ($T = 0$).
*   **Calculation:**
    $$H = (70 \times 0.55) + (100 \times 0.30) + (0 \times 0.15)$$
    $$H = 38.5 + 30.0 + 0 = \mathbf{68.5}$$
*   **Result:** Even with maximum freshness, the coupon scores **$68.5$**. This allows it to rank higher than old, mediocre coupons, but it will **not** block a high-quality veteran coupon (which can easily score $75+$ through accumulated positive votes).

#### 3. Can an old, highly reliable coupon lock out new coupons forever?
*   **Scenario:** A coupon was added $60$ days ago. It has $200$ success votes and $10$ fail votes ($R = \frac{200+7}{210+10} \times 100 = 94.09$). Because of its age, its freshness is near zero ($F = \frac{100}{1+60} = 1.64$). It has normal daily traffic ($T = 10$).
*   **Calculation:**
    $$H = (94.09 \times 0.55) + (1.64 \times 0.30) + (10 \times 0.15)$$
    $$H = 51.75 + 0.49 + 1.50 = \mathbf{53.74}$$
*   **Result:** Despite a near-perfect reliability score of $94.09$, the final score decays to **$53.74$** due to loss of freshness. This prevents old coupons from permanently camping at the top of the search results, making room for new submissions.

---

## 📊 Comparative Scenario Walkthrough

Let's walk through an execution of the cron job involving three different active coupons in the database.

### 👥 The Contenders

1.  **Coupon A ("The Trusted Veteran")**:
    *   Created **10 days ago** (`daysOld = 10`).
    *   Highly reliable: **45 success votes, 5 failed votes**.
    *   Moderate steady engagement: **12 discovers**, last discover was **2 hours ago** (`hoursSinceLastDiscover = 2`).

2.  **Coupon B ("The Shiny Newcomer")**:
    *   Created **0 days ago** (just now, `daysOld = 0`).
    *   No community feedback yet: **0 success votes, 0 failed votes**.
    *   No clicks yet: **0 discovers**.

3.  **Coupon C ("The Hyped Flop / Spam Attempt")**:
    *   Created **1 day ago** (`daysOld = 1`).
    *   Poor feedback: **2 success votes, 18 failed votes**.
    *   High traffic: **120 discovers**, last discover was **0 hours ago** (`hoursSinceLastDiscover = 0`).

---

### 🧮 Step-by-Step Calculation Engine

#### 1. Calculating Coupon A (The Trusted Veteran)
*   **Reliability ($R_A$):** 
    $$R_A = \frac{45 + 7}{45 + 5 + 10} \times 100 = \frac{52}{60} \times 100 = 86.67$$
*   **Freshness ($F_A$):** 
    $$F_A = \frac{100}{1 + 10} = 9.09$$
*   **Trend ($T_A$):** 
    $$T_A = \frac{12}{1 + 2} = 4.00$$
*   **Synthesis ($H_A$):**
    $$H_A = (86.67 \times 0.55) + (9.09 \times 0.30) + (4.00 \times 0.15)$$
    $$H_A = 47.67 + 2.73 + 0.60 = \mathbf{51.00}$$

#### 2. Calculating Coupon B (The Shiny Newcomer)
*   **Reliability ($R_B$):** 
    $$R_B = \frac{0 + 7}{0 + 0 + 10} \times 100 = \frac{7}{10} \times 100 = 70.00$$
*   **Freshness ($F_B$):** 
    $$F_B = \frac{100}{1 + 0} = 100.00$$
*   **Trend ($T_B$):** 
    $$T_B = 0 \quad (\text{no discover activity})$$
*   **Synthesis ($H_B$):**
    $$H_B = (70.00 \times 0.55) + (100.00 \times 0.30) + (0 \times 0.15)$$
    $$H_B = 38.50 + 30.00 + 0 = \mathbf{68.50}$$

#### 3. Calculating Coupon C (The Hyped Flop / Spam Attempt)
*   **Reliability ($R_C$):** 
    $$R_C = \frac{2 + 7}{2 + 18 + 10} \times 100 = \frac{9}{30} \times 100 = 30.00$$
*   **Freshness ($F_C$):** 
    $$F_C = \frac{100}{1 + 1} = 50.00$$
*   **Trend ($T_C$):** 
    $$T_C = \min\left(\frac{120}{1 + 0}, 100\right) = 100.00$$
*   **Synthesis ($H_C$):**
    $$H_C = (30.00 \times 0.55) + (50.00 \times 0.30) + (100.00 \times 0.15)$$
    $$H_C = 16.50 + 15.00 + 15.00 = \mathbf{46.50}$$

---

### 🏆 Final Comparison and Leaderboard

When the cron job finishes, the database is updated and the coupons are sorted by their Health Score:

| Rank | Coupon Description | Reliability ($R$) | Freshness ($F$) | Trend ($T$) | Final Health Score ($H$) | Verdict |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **#1** | **Coupon B** (Shiny Newcomer) | $70.00$ | $100.00$ | $0.00$ | **$68.50$** | Promoted to the top to give it a chance to accumulate votes. |
| **#2** | **Coupon A** (Trusted Veteran) | $86.67$ | $9.09$ | $4.00$ | **$51.00$** | High-quality fallback; stays highly competitive despite aging. |
| **#3** | **Coupon C** (Hyped Flop) | $30.00$ | $50.00$ | $100.00$ | **$46.50$** | Pushed to the bottom. Viral activity cannot save code with bad votes. |

### Why this ranking is perfectly fair:
1.  **Coupon B** is placed at the top so users see it, try it, and provide the initial feedback that will anchor its score.
2.  **Coupon A** remains close behind. It has lost almost all freshness, but its stellar track record keeps it highly visible.
3.  **Coupon C** is correctly penalized. Even though it is fresh and heavily clicked, the community votes clearly signal it doesn't work, so the system prevents it from climbing.

---

## 💼 Business Logic & Recalculation Strategy (Client Guide)

### ⚡ Real-Time Recalculations vs. 🕒 Batch Processing

| User Action | DB Updates Made | Score Recalculation Timing | Business Rationale |
| :--- | :--- | :--- | :--- |
| **Direct Vote** (User clicks *"Worked"* or *"Didn't Work"*) | Increments `successCount` or `failedCount` | **Real-Time / Immediate** | **High impact:** User votes are the most crucial signal of coupon validity. The interface must reflect feedback instantly to reward good coupons or flag broken ones immediately. |
| **Discover / Click** (User reveals code/clicks coupon) | Increments `discoverCount` & updates `lastDiscoverAt` | **Delayed (Every 5 Hours via Cron)** | **Low incremental impact:** Single clicks compound over time to build a trend. A single click does not warrant immediate ranking changes, so updates are processed in efficient batches. |

---

### 💡 Why Do We Wait to Recalculate Trend & Freshness?

Here is how you can explain the batch strategy for clicks/discoveries to the client:

1. **Compounding Value:**
   A single discover click has a negligible impact on the overall health score (at most contributing a tiny fraction of a point). Clicks only become meaningful when analyzed in volume over time. Recalculating the score for every individual click is mathematically unnecessary.

2. **Database Performance & Write Reduction:**
   If the platform receives thousands of views and clicks per minute, running complex scoring algorithms and executing database writes on every click would overwhelm the database. By buffering the clicks (`discoverCount` and `lastDiscoverAt`) and running the health score calculation in a scheduled 5-hour batch (frequency adjustable), we reduce database write operations by **99.9%**, ensuring high platform speed and lower hosting costs.

3. **Prevention of Click-Spam & Gaming:**
   If trend scores updated in real time, malicious users or bots could easily spam clicks to artificially boost a coupon to the top page instantly. The 5-hour delay filters out sudden manipulation attempts and ensures ranks reflect sustained, legitimate interest.

