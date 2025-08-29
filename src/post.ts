import {cleanup, saveCache} from './actions'

saveCache().finally(() => cleanup())
