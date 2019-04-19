USE partnet_anno_system;

CREATE TABLE Annotation
(
  annotationID   BIGINT(20) AUTO_INCREMENT        PRIMARY KEY,
  modelID        CHAR(100)       NOT NULL,
  modelCat       CHAR(20)        NOT NULL,
  workerID CHAR(100)       NOT NULL,
  annoState      CHAR(50) DEFAULT 'active' NOT NULL,
  annoStartTime  timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  annoUpdateTime timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  version        INT DEFAULT '0' NOT NULL
)
  ENGINE = InnoDB;

CREATE INDEX Annotation_Model_modelID_fk
  ON Annotation (modelID);

CREATE INDEX Annotation_Worker_workerID_fk
  ON Annotation (workerID);

CREATE TABLE Model
(
  modelID        CHAR(100) NOT NULL PRIMARY KEY,
  categoryID     CHAR(100) NOT NULL,
  numAnno        INT(20) Default '0' NOT NULL
)
  ENGINE = InnoDB;

ALTER TABLE Annotation
  ADD CONSTRAINT Annotation_Model_modelID_fk
FOREIGN KEY (modelID) REFERENCES Model (modelID);

CREATE TABLE Worker
(
  workerID CHAR(100) NOT NULL
    PRIMARY KEY,
  password       CHAR(100) NULL,
  realname       CHAR(100) NULL,
  email          CHAR(100) NULL,
  ip             CHAR(40)  NULL,
  CONSTRAINT Worker_workerID_uindex
  UNIQUE (workerID)
)
  ENGINE = InnoDB;

ALTER TABLE Annotation
  ADD CONSTRAINT Annotation_Worker_workerID_fk
FOREIGN KEY (workerID) REFERENCES Worker (workerID);
