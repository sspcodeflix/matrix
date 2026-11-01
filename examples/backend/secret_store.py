"""SecretStore for user PATs (POC): MongoDB client-side field-level encryption.

The master key (96 bytes, base64) is mounted from an OpenShift Secret into the
credential broker pod only. Swap the KMS provider from "local" to KMIP later
without changing callers.
"""
import base64
import os
from datetime import datetime, timezone
from typing import Protocol

from bson.binary import STANDARD
from bson.codec_options import CodecOptions
from pymongo import MongoClient
from pymongo.encryption import Algorithm, ClientEncryption

KEY_ALT_NAME = "matrix-user-tokens"
ALG = Algorithm.AEAD_AES_256_CBC_HMAC_SHA_512_Random


class SecretStore(Protocol):
    def store(self, user_id: str, system: str, token: str, expires: datetime | None) -> None: ...
    def read(self, user_id: str, system: str) -> str: ...
    def delete(self, user_id: str, system: str) -> None: ...


class MongoEncryptedSecretStore:
    def __init__(self, mongo_uri: str, master_key_path: str, audit):
        master = base64.b64decode(open(master_key_path).read())
        self._client = MongoClient(mongo_uri)
        self._ce = ClientEncryption({"local": {"key": master}}, "encryption.__keyVault",
                                    self._client, CodecOptions(uuid_representation=STANDARD))
        self._creds = self._client.matrix.user_credentials
        self._audit = audit

    def ensure_setup(self) -> None:
        kv = self._client.encryption["__keyVault"]
        kv.create_index("keyAltNames", unique=True,
                        partialFilterExpression={"keyAltNames": {"$exists": True}})
        if not kv.find_one({"keyAltNames": KEY_ALT_NAME}):
            self._ce.create_data_key("local", key_alt_names=[KEY_ALT_NAME])

    def store(self, user_id, system, token, expires=None):
        enc = self._ce.encrypt(token, ALG, key_alt_name=KEY_ALT_NAME)
        self._creds.update_one(
            {"_id": f"{user_id}:{system}"},
            {"$set": {"token": enc, "last4": token[-4:], "expires": expires,
                      "updatedAt": datetime.now(timezone.utc)}},
            upsert=True)
        self._audit("credential.store", user_id=user_id, target=system)

    def read(self, user_id, system):
        doc = self._creds.find_one({"_id": f"{user_id}:{system}"})
        if not doc:
            raise KeyError(f"No {system} token for {user_id}")
        self._audit("credential.read", user_id=user_id, target=system)
        return self._ce.decrypt(doc["token"])  # use for one call, never cache or log

    def delete(self, user_id, system):
        self._creds.delete_one({"_id": f"{user_id}:{system}"})
        self._audit("credential.delete", user_id=user_id, target=system)
