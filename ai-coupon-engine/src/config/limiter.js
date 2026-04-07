import Bottleneck from "bottleneck"

export const limiter = new Bottleneck({
    minTime: 200 //for 5 req per sec
})