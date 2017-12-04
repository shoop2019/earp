/* -*- Mode: C++; tab-width: 8; indent-tabs-mode: nil; c-basic-offset: 2 -*- */
/* vim: set ts=2 et sw=2 tw=80: */
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this file,
 * You can obtain one at http://mozilla.org/MPL/2.0/. */

#include "RDBWrapperCache.h"
#include "nsCycleCollector.h"

NS_IMPL_CYCLE_COLLECTION_CLASS(RDBWrapperCache)

NS_IMPL_CYCLE_COLLECTION_TRAVERSE_BEGIN_INHERITED(RDBWrapperCache,
                                                  DOMEventTargetHelper)
  // Don't need NS_IMPL_CYCLE_COLLECTION_TRAVERSE_SCRIPT_OBJECTS because
  // DOMEventTargetHelper does it for us.
NS_IMPL_CYCLE_COLLECTION_TRAVERSE_END

NS_IMPL_CYCLE_COLLECTION_UNLINK_BEGIN_INHERITED(RDBWrapperCache,
                                                DOMEventTargetHelper)
  if (tmp->mScriptOwner) {
    tmp->mScriptOwner = nullptr;
    mozilla::DropJSObjects(tmp);
  }
NS_IMPL_CYCLE_COLLECTION_UNLINK_END

NS_IMPL_CYCLE_COLLECTION_TRACE_BEGIN_INHERITED(RDBWrapperCache,
                                               DOMEventTargetHelper)
  // Don't need NS_IMPL_CYCLE_COLLECTION_TRACE_PRESERVED_WRAPPER because
  // DOMEventTargetHelper does it for us.
  NS_IMPL_CYCLE_COLLECTION_TRACE_JS_MEMBER_CALLBACK(mScriptOwner)
NS_IMPL_CYCLE_COLLECTION_TRACE_END

NS_INTERFACE_MAP_BEGIN_CYCLE_COLLECTION_INHERITED(RDBWrapperCache)
NS_INTERFACE_MAP_END_INHERITING(DOMEventTargetHelper)

NS_IMPL_ADDREF_INHERITED(RDBWrapperCache, DOMEventTargetHelper)
NS_IMPL_RELEASE_INHERITED(RDBWrapperCache, DOMEventTargetHelper)

RDBWrapperCache::~RDBWrapperCache()
{
  mScriptOwner = nullptr;
  ReleaseWrapper(this);
  mozilla::DropJSObjects(this);
}

void
RDBWrapperCache::SetScriptOwner(JSObject* aScriptOwner)
{
  NS_ASSERTION(aScriptOwner, "This should never be null!");

  mScriptOwner = aScriptOwner;
  mozilla::HoldJSObjects(this);
}

#ifdef DEBUG
void
RDBWrapperCache::AssertIsRooted() const
{
  MOZ_ASSERT(cyclecollector::IsJSHolder(const_cast<RDBWrapperCache*>(this)),
             "Why aren't we rooted?!");
}
#endif