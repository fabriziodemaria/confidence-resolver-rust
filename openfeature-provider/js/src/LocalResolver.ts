import type {
  ResolveFlagsRequest,
  ResolveFlagsResponse,
  ResolveWithStickyRequest,
  ResolveWithStickyResponse,
  SetResolverStateRequest
} from "./proto/api"

export interface LocalResolver {
  resolveFlags(request: ResolveFlagsRequest): ResolveFlagsResponse
  resolveWithSticky(request: ResolveWithStickyRequest): ResolveWithStickyResponse
  setResolverState(request: SetResolverStateRequest):void
  flushLogs():Uint8Array
}

export interface AccessToken {
  accessToken: string,
  /// lifetime seconds
  expiresIn: number
}

export interface ResolveStateUri {
  signedUri:string, 
  account: string,
}
